'use strict';

/**
 * Lazy ioredis connection factory.
 *
 * Everything here returns null rather than throwing when REDIS_URL is unset or
 * ioredis is not installed. Redis is strictly an upgrade in this system: the
 * MySQL driver is the default and nothing may break in its absence.
 */

let IORedis = null;
let publisher = null;

function load() {
    if (IORedis) return IORedis;
    try {
        // eslint-disable-next-line global-require
        IORedis = require('ioredis');
        return IORedis;
    } catch (_) {
        return null;
    }
}

/** @returns {import('ioredis').Redis|null} */
function createConnection(options = {}) {
    if (!process.env.REDIS_URL) return null;
    const Redis = load();
    if (!Redis) {
        console.warn('[emailQueue] REDIS_URL is set but ioredis is not installed — falling back to MySQL.');
        return null;
    }
    return new Redis(process.env.REDIS_URL, {
        // BullMQ requires this; harmless for the pub/sub connections.
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        ...options,
    });
}

/** Shared publisher for settings invalidation. */
function getPublisher() {
    if (publisher) return publisher;
    publisher = createConnection();
    if (publisher) publisher.on('error', (e) => console.warn('[emailQueue] redis publisher error:', e.message));
    return publisher;
}

/** A dedicated connection — a subscriber cannot issue other commands. */
function createSubscriber() {
    const sub = createConnection();
    if (sub) sub.on('error', (e) => console.warn('[emailQueue] redis subscriber error:', e.message));
    return sub;
}

/** True when Redis is configured and the client library is present. */
function isAvailable() {
    return Boolean(process.env.REDIS_URL && load());
}

async function closeAll() {
    if (publisher) {
        try { await publisher.quit(); } catch (_) { /* already closed */ }
        publisher = null;
    }
}

module.exports = { createConnection, getPublisher, createSubscriber, isAvailable, closeAll };
