'use strict';

/**
 * MySQL-backed queue driver. The default, and the reference implementation.
 *
 * Concurrency safety rests on a two-statement claim: an UPDATE stamps a unique
 * token on a batch of pending rows, then a SELECT reads back exactly that
 * token's rows.
 *
 * Why not SELECT ... FOR UPDATE SKIP LOCKED, which MySQL 8 does support: it
 * requires holding a transaction open across the read, and this worker then
 * does SMTP network I/O. Holding transactions across a network call against a
 * small connection pool is precisely how you exhaust the pool and take the API
 * down with it. The UPDATE here holds row locks for single-digit milliseconds.
 *
 * The safety argument: worker B's UPDATE blocks on worker A's row locks, and
 * when it proceeds those rows no longer satisfy status='pending'. Disjoint
 * claim sets are therefore structural, not probabilistic.
 */

const crypto = require('crypto');
const os = require('os');
const { QueryTypes } = require('sequelize');
const sequelize = require('../../utils/database');
const EmailJob = require('../../models/EmailJob');
const { backoffMs } = require('./backoff');

const WORKER_ID = `${os.hostname()}:${process.pid}`.slice(0, 64);
const LEASE_SECONDS = Number(process.env.EMAIL_LEASE_SECONDS || 120);
const BATCH_SIZE = Number(process.env.EMAIL_BATCH_SIZE || 10);
const IDLE_POLL_MS = Number(process.env.EMAIL_POLL_MS || 5000);

const driverName = 'mysql';

let running = false;
let draining = false;
let inFlight = 0;

/**
 * @param {Object} job
 * @returns {Promise<{queued:boolean, reason?:string}>}
 */
async function enqueue(job) {
    try {
        await EmailJob.create({
            emailLogId: job.emailLogId,
            dedupKey: job.dedupKey,
            priority: job.priority || 3,
            runAt: job.runAt || new Date(),
            maxAttempts: job.maxAttempts || 5,
            status: 'pending',
        }, { transaction: job.transaction });
        return { queued: true };
    } catch (err) {
        // The unique index on dedupKey is the guarantee. Catching the duplicate
        // here rather than checking first is deliberate: the uniqueness test IS
        // the write, so there is no window between check and insert.
        if (err.name === 'SequelizeUniqueConstraintError' || err.original?.errno === 1062) {
            return { queued: false, reason: 'duplicate' };
        }
        throw err;
    }
}

/** Claim up to `limit` due jobs for this worker. */
async function claim(limit = BATCH_SIZE) {
    const token = crypto.randomUUID();

    const [, affected] = await sequelize.query(
        'UPDATE `EmailJobs` ' +
        '   SET `claimToken` = ?, `status` = \'processing\', `lockedBy` = ?, ' +
        '       `lockedAt` = NOW(), `leaseExpiresAt` = DATE_ADD(NOW(), INTERVAL ? SECOND), ' +
        // Incremented at CLAIM time, not on failure: a worker killed mid-send
        // must still burn the attempt, because we cannot know whether the SMTP
        // DATA command completed. At-most-once is the right bias for email.
        '       `attempts` = `attempts` + 1, `updatedAt` = NOW() ' +
        ' WHERE `status` = \'pending\' AND `runAt` <= NOW() ' +
        ' ORDER BY `priority` ASC, `runAt` ASC, `id` ASC ' +
        ' LIMIT ?',
        { replacements: [token, WORKER_ID, LEASE_SECONDS, limit] }
    );

    if (!affected) return [];

    return sequelize.query(
        'SELECT * FROM `EmailJobs` WHERE `claimToken` = ?',
        { replacements: [token], type: QueryTypes.SELECT }
    );
}

/** Job succeeded: drop it. EmailLog is the permanent record. */
async function complete(job) {
    await EmailJob.destroy({ where: { id: job.id } });
}

/**
 * Job failed. Either schedule a retry or bury it in the dead-letter state.
 * @param {Object} job
 * @param {Error} err
 * @param {boolean} retryable
 */
async function fail(job, err, retryable = true) {
    const exhausted = job.attempts >= job.maxAttempts;

    if (!retryable || exhausted) {
        await EmailJob.update(
            {
                status: 'dead',
                claimToken: null,
                lockedBy: null,
                leaseExpiresAt: null,
                lastError: String(err.message || err).slice(0, 2000),
            },
            { where: { id: job.id } }
        );
        return { dead: true };
    }

    await EmailJob.update(
        {
            status: 'pending',
            claimToken: null,
            lockedBy: null,
            leaseExpiresAt: null,
            runAt: new Date(Date.now() + backoffMs(job.attempts)),
            lastError: String(err.message || err).slice(0, 2000),
        },
        { where: { id: job.id } }
    );
    return { dead: false };
}

/**
 * Reclaim leases from workers that died mid-send.
 *
 * This is what makes a SIGKILL safe, and therefore what makes the graceful
 * drain an optimisation rather than a correctness requirement.
 *
 * @returns {Promise<number>} rows reclaimed
 */
async function sweep() {
    const [, affected] = await sequelize.query(
        'UPDATE `EmailJobs` ' +
        '   SET `status` = IF(`attempts` >= `maxAttempts`, \'dead\', \'pending\'), ' +
        '       `claimToken` = NULL, `lockedBy` = NULL, `leaseExpiresAt` = NULL, ' +
        '       `runAt` = DATE_ADD(NOW(), INTERVAL LEAST(POW(2, `attempts`) * 30, 3600) SECOND), ' +
        '       `lastError` = CONCAT(\'lease expired (worker \', COALESCE(`lockedBy`, \'?\'), \')\'), ' +
        '       `updatedAt` = NOW() ' +
        ' WHERE `status` = \'processing\' AND `leaseExpiresAt` < NOW()'
    );
    return affected || 0;
}

/**
 * Poll loop. Handler must resolve; it is responsible for its own error
 * reporting and calls back into complete()/fail() via the returned outcome.
 *
 * @param {(job:Object)=>Promise<void>} handler
 * @param {{concurrency?:number}} [opts]
 */
function process_(handler, opts = {}) {
    const concurrency = Math.max(1, Number(opts.concurrency || 3));
    running = true;

    const tick = async () => {
        if (!running || draining) return;

        let claimed = [];
        try {
            const capacity = Math.max(0, concurrency - inFlight);
            if (capacity > 0) claimed = await claim(Math.min(capacity, BATCH_SIZE));
        } catch (err) {
            console.error('[emailQueue] claim failed:', err.message);
        }

        if (claimed.length === 0) {
            setTimeout(tick, IDLE_POLL_MS).unref?.();
            return;
        }

        await Promise.all(claimed.map(async (job) => {
            inFlight += 1;
            try {
                await handler(job);
            } catch (err) {
                // handler owns its failures; this is the last-resort net so one
                // bad job cannot stop the loop.
                console.error('[emailQueue] handler threw:', err.message);
                try { await fail(job, err, true); } catch (_) { /* nothing left to do */ }
            } finally {
                inFlight -= 1;
            }
        }));

        // A full batch means there is probably more waiting — go straight round
        // again rather than sleeping, so a burst drains at full speed.
        setImmediate(tick);
    };

    tick();
}

/** Stop claiming, let in-flight work finish. */
async function drain({ timeoutMs = 20000 } = {}) {
    draining = true;
    const deadline = Date.now() + timeoutMs;
    while (inFlight > 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 200));
    }

    // Anything still claimed by this worker goes back to pending immediately,
    // rather than waiting out its 120s lease.
    try {
        await sequelize.query(
            'UPDATE `EmailJobs` SET `status` = \'pending\', `claimToken` = NULL, ' +
            '`lockedBy` = NULL, `leaseExpiresAt` = NULL, `updatedAt` = NOW() ' +
            'WHERE `status` = \'processing\' AND `lockedBy` = ?',
            { replacements: [WORKER_ID] }
        );
    } catch (err) {
        console.warn('[emailQueue] lease release on drain failed:', err.message);
    }

    running = false;
    return { inFlight };
}

/** Queue depth by state, for the admin status panel. */
async function stats() {
    const rows = await sequelize.query(
        'SELECT `status`, COUNT(*) AS n, MIN(`runAt`) AS oldest FROM `EmailJobs` GROUP BY `status`',
        { type: QueryTypes.SELECT }
    );
    const out = { pending: 0, processing: 0, dead: 0, oldestPendingAt: null, driver: driverName };
    for (const r of rows) {
        out[r.status] = Number(r.n);
        if (r.status === 'pending') out.oldestPendingAt = r.oldest;
    }
    return out;
}

async function close() {
    running = false;
}

module.exports = {
    driverName,
    enqueue,
    claim,
    complete,
    fail,
    sweep,
    process: process_,
    drain,
    stats,
    close,
    WORKER_ID,
};
