'use strict';

/**
 * Queue facade. Picks a driver once at load and logs which one.
 *
 * Nothing above this layer knows or cares whether jobs live in MySQL or Redis,
 * which is what makes "add REDIS_URL later" a genuine one-line change rather
 * than a migration.
 */

const { isAvailable } = require('./redisClient');

let driver;

if (isAvailable()) {
    try {
        driver = require('./bullmqDriver');
        console.log('[emailQueue] driver=bullmq (REDIS_URL set)');
    } catch (err) {
        // bullmq missing or broken: the MySQL driver is always a valid answer,
        // so degrade rather than refusing to start.
        console.warn('[emailQueue] bullmq unavailable (%s) — falling back to MySQL.', err.message);
        driver = require('./mysqlDriver');
    }
} else {
    driver = require('./mysqlDriver');
    console.log('[emailQueue] driver=mysql (REDIS_URL not set)');
}

module.exports = {
    get driverName() { return driver.driverName; },
    enqueue: (job) => driver.enqueue(job),
    complete: (job) => driver.complete(job),
    fail: (job, err, retryable) => driver.fail(job, err, retryable),
    sweep: () => driver.sweep(),
    process: (handler, opts) => driver.process(handler, opts),
    drain: (opts) => driver.drain(opts),
    stats: () => driver.stats(),
    close: () => driver.close(),
};
