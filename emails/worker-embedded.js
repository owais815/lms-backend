'use strict';

/**
 * In-process worker, for development and small single-process deployments.
 *
 * Enabled with EMAIL_WORKER_EMBEDDED=true. Running it in production means SMTP
 * latency competes with request handling for the event loop, so it refuses to
 * start there unless someone has explicitly said they want that.
 */

const queue = require('./queue');
const processor = require('./processor');

let started = false;

function start() {
    if (started) return;

    if (process.env.NODE_ENV === 'production' && process.env.EMAIL_ALLOW_EMBEDDED_PROD !== 'true') {
        console.warn(
            '[emailWorker] EMAIL_WORKER_EMBEDDED is set but NODE_ENV=production — refusing to start in-process. ' +
            'Run the standalone worker (npm run worker), or set EMAIL_ALLOW_EMBEDDED_PROD=true if this is deliberate.'
        );
        return;
    }

    // Concurrency 1: this shares an event loop with the API, so it should stay
    // out of the way rather than go fast.
    queue.process(processor.handle, { concurrency: 1 });
    require('../Schedular/emailQueueSweeper').startEmailQueueSweeper();
    require('../Schedular/emailReminders').startEmailRemindersCron();
    require('../Schedular/emailDigests').startEmailDigestsCron();

    started = true;
    console.log('[emailWorker] running EMBEDDED in the API process (concurrency=1).');
}

module.exports = { start };
