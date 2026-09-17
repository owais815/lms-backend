'use strict';

/**
 * BullMQ + Redis driver. Used automatically when REDIS_URL is set.
 *
 * Deliberately exposes the same surface as mysqlDriver, including complete()
 * and fail(), which BullMQ would normally handle through thrown errors. Keeping
 * the shapes identical means the processor has no idea which driver it is
 * running under, and switching is genuinely a one-line env change.
 *
 * Note the EmailLogs unique index still does the dedup work even here — jobId
 * gives BullMQ-level dedup as a bonus, but the database constraint is what the
 * guarantee actually rests on, and it survives a Redis flush.
 */

const EmailJob = require('../../models/EmailJob');
const { createConnection } = require('./redisClient');

const QUEUE_NAME = process.env.EMAIL_QUEUE_NAME || 'lms:email';
const driverName = 'bullmq';

let Queue = null;
let Worker = null;
let queue = null;
let worker = null;
let connection = null;

function lib() {
    if (Queue) return { Queue, Worker };
    // eslint-disable-next-line global-require
    const bullmq = require('bullmq');
    Queue = bullmq.Queue;
    Worker = bullmq.Worker;
    return { Queue, Worker };
}

function getQueue() {
    if (queue) return queue;
    const { Queue: Q } = lib();
    connection = connection || createConnection();
    queue = new Q(QUEUE_NAME, {
        connection,
        defaultJobOptions: {
            removeOnComplete: 1000,
            // Failures are the dead-letter queue — never auto-remove them.
            removeOnFail: false,
        },
    });
    return queue;
}

async function enqueue(job) {
    // The EmailJobs row is still written so the admin status panel, the sweeper
    // and the delivery log behave identically under both drivers.
    let row;
    try {
        row = await EmailJob.create({
            emailLogId: job.emailLogId,
            dedupKey: job.dedupKey,
            priority: job.priority || 3,
            runAt: job.runAt || new Date(),
            maxAttempts: job.maxAttempts || 5,
            status: 'pending',
        }, { transaction: job.transaction });
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError' || err.original?.errno === 1062) {
            return { queued: false, reason: 'duplicate' };
        }
        throw err;
    }

    const delay = Math.max(0, new Date(job.runAt || Date.now()).getTime() - Date.now());

    await getQueue().add(
        'email',
        { jobRowId: row.id, emailLogId: job.emailLogId },
        {
            jobId: job.dedupKey,
            delay,
            priority: job.priority || 3,
            attempts: job.maxAttempts || 5,
            backoff: { type: 'exponential', delay: 60_000 },
        }
    );

    return { queued: true };
}

async function complete(job) {
    await EmailJob.destroy({ where: { id: job.id } });
}

async function fail(job, err, retryable = true) {
    const exhausted = job.attempts >= job.maxAttempts;
    if (!retryable || exhausted) {
        await EmailJob.update(
            { status: 'dead', lastError: String(err.message || err).slice(0, 2000) },
            { where: { id: job.id } }
        );
        return { dead: true };
    }
    await EmailJob.update(
        { status: 'pending', lastError: String(err.message || err).slice(0, 2000) },
        { where: { id: job.id } }
    );
    return { dead: false };
}

function process_(handler, opts = {}) {
    const { Worker: W } = lib();
    connection = connection || createConnection();

    worker = new W(
        QUEUE_NAME,
        async (bullJob) => {
            const row = await EmailJob.findByPk(bullJob.data.jobRowId);
            if (!row) return; // log row already resolved elsewhere

            // Mirror the MySQL driver's claim-time increment so retry accounting
            // means the same thing under both drivers.
            await EmailJob.update(
                { status: 'processing', attempts: row.attempts + 1 },
                { where: { id: row.id } }
            );

            await handler({ ...row.get({ plain: true }), attempts: row.attempts + 1 });
        },
        { connection, concurrency: Math.max(1, Number(opts.concurrency || 3)) }
    );

    worker.on('failed', (job, err) => {
        console.error(`[emailQueue] job ${job?.id} failed:`, err?.message);
    });
}

/** No-op: BullMQ's own stalled-job handling covers what sweep() does for MySQL. */
async function sweep() {
    return 0;
}

async function drain({ timeoutMs = 20000 } = {}) {
    if (worker) await worker.close();
    return { inFlight: 0, timeoutMs };
}

async function stats() {
    const q = getQueue();
    const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'failed');
    return {
        pending: (counts.waiting || 0) + (counts.delayed || 0),
        processing: counts.active || 0,
        dead: counts.failed || 0,
        oldestPendingAt: null,
        driver: driverName,
    };
}

async function close() {
    if (worker) { await worker.close(); worker = null; }
    if (queue) { await queue.close(); queue = null; }
    if (connection) { await connection.quit().catch(() => {}); connection = null; }
}

module.exports = {
    driverName,
    enqueue,
    complete,
    fail,
    sweep,
    process: process_,
    drain,
    stats,
    close,
};
