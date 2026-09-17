'use strict';

/**
 * Lease reclamation and alert evaluation. Runs in the worker only.
 *
 * This is what makes a SIGKILL safe: a worker that dies mid-send leaves its
 * jobs in 'processing' with an expired lease, and this sweep returns them to
 * 'pending' with exponential backoff. Because attempts were already incremented
 * at claim time, a job cannot retry forever by being killed repeatedly.
 */

const cron = require('node-cron');
const queue = require('../emails/queue');
const alerts = require('../emails/alerts');

function startEmailQueueSweeper() {
    // Every minute: the lease is 120s, so this reclaims within one lease period.
    cron.schedule('* * * * *', async () => {
        try {
            const reclaimed = await queue.sweep();
            if (reclaimed > 0) {
                console.log(`[emailSweeper] reclaimed ${reclaimed} expired lease(s).`);
            }

            const stats = await queue.stats();
            await alerts.evaluate({ stats });
        } catch (err) {
            console.error('[emailSweeper] sweep failed:', err.message);
        }
    });

    console.log('[emailSweeper] started (runs every minute).');
}

module.exports = { startEmailQueueSweeper };
