'use strict';

/**
 * Email worker entrypoint.  Run with: npm run worker
 *
 * Separate from app.js so that SMTP latency never competes with request
 * handling for the event loop, and so the worker can be restarted or scaled
 * without touching the API.
 *
 * It deliberately does NOT own the nine existing business crons. Those reach
 * notify() -> getIO() -> onlineUsers, which in a socket-less process would
 * still write notification rows but silently stop emitting them in real time —
 * a regression users would notice and nobody would attribute to this change.
 * Moving them is a later, separate piece of work.
 */

require('dotenv').config();

// Mandatory, same as app.js: models are only registered with Sequelize when
// this file pulls them in.
require('./models/association');

const sequelize = require('./utils/database');
const queue = require('./emails/queue');
const processor = require('./emails/processor');
const settingsCache = require('./emails/settings/cache');
const transport = require('./emails/transport');
const { verifyDedupIndex } = require('./emails/schema-patch');

const CONCURRENCY = Number(process.env.EMAIL_CONCURRENCY || 3);
const DRAIN_TIMEOUT_MS = Number(process.env.EMAIL_DRAIN_TIMEOUT_MS || 20000);

let shuttingDown = false;

async function boot() {
    // authenticate, NOT sync — only the API process owns schema. Two processes
    // running alter-sync against the same database is a good way to deadlock a
    // deploy.
    await sequelize.authenticate();
    console.log('[worker] database connected.');

    // The never-double-send guarantee is one unique index. If it is missing,
    // this process would happily send duplicates and nobody would notice until
    // a parent complained about four copies of the same invoice.
    if (!(await verifyDedupIndex())) {
        console.error(
            '[worker] FATAL: unique index uq_emaillog_dedup is missing from EmailLogs.\n' +
            '         Deduplication cannot be guaranteed, so the worker will not start.\n' +
            '         Start the API once (it applies emails/schema-patch.js), then retry.'
        );
        process.exit(1);
    }

    await settingsCache.start();

    const mode = settingsCache.get('global.mode', 'log');

    // Probe SMTP early so a credential problem shows up at boot rather than on
    // the first password-reset email at 2am. Non-fatal: queued mail is durable,
    // and the per-send path will retry.
    if (mode !== 'log') {
        try {
            await transport.verify(mode);
            console.log('[worker] SMTP connection verified.');
        } catch (err) {
            console.error('[worker] SMTP verify failed (will retry per send):', err.message);
            require('./emails/alerts').raise('transport_down', { error: err.message }).catch(() => {});
        }
    }

    queue.process(processor.handle, { concurrency: CONCURRENCY });

    require('./Schedular/emailQueueSweeper').startEmailQueueSweeper();
    require('./Schedular/emailReminders').startEmailRemindersCron();
    require('./Schedular/emailDigests').startEmailDigestsCron();

    console.log(
        `[worker] started — driver=${queue.driverName} mode=${mode} ` +
        `concurrency=${CONCURRENCY} pool=${process.env.DB_POOL_MAX || 10}`
    );
}

/**
 * Graceful drain.
 *
 * PM2's default kill_timeout is 1600ms, which would SIGKILL mid-drain — see
 * kill_timeout in ecosystem.config.js. Note that a SIGKILL is still *safe*: the
 * sweeper reclaims expired leases within 60s. This drain is a latency
 * optimisation, not a correctness requirement, which is the right way round.
 */
async function shutdown(signal) {
    if (shuttingDown) return; // PM2 can send the signal twice
    shuttingDown = true;
    console.log(`[worker] ${signal} received, draining…`);

    const force = setTimeout(() => {
        console.error('[worker] drain timed out, forcing exit.');
        process.exit(1);
    }, DRAIN_TIMEOUT_MS + 5000);

    try {
        await queue.drain({ timeoutMs: DRAIN_TIMEOUT_MS });
        await settingsCache.stop();
        await transport.close();
        await queue.close();
        await sequelize.close();
        console.log('[worker] drained cleanly.');
    } catch (err) {
        console.error('[worker] error during shutdown:', err.message);
    } finally {
        clearTimeout(force);
        process.exit(0);
    }
}

['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, () => shutdown(sig)));

process.on('unhandledRejection', (reason) => {
    console.error('[worker] unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[worker] uncaught exception:', err);
    shutdown('uncaughtException');
});

boot().catch((err) => {
    console.error('[worker] fatal boot error:', err);
    process.exit(1);
});
