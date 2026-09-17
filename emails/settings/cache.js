'use strict';

/**
 * In-memory settings snapshot.
 *
 * The send path reads settings on every dispatch, so it must not query. This
 * module holds a frozen snapshot and refreshes it only when the single-row
 * version counter moves — one tiny primary-key read every 15 seconds per
 * process, against a snapshot read that costs nothing.
 *
 * Cross-process invalidation (the API writes, the worker must notice) is the
 * version poll. Redis pub/sub is layered on top when available to cut the delay
 * from ~15s to ~1ms, but it is never required: a settings system that stops
 * working when Redis is absent would be a worse trade than 15 seconds of
 * staleness on an email toggle.
 */

const store = require('./store');

const POLL_MS = Number(process.env.EMAIL_SETTINGS_POLL_MS || 15000);

/** @type {{version:number, globals:Object, events:Object, loadedAt:Date}|null} */
let snapshot = null;
let timer = null;
let redisSub = null;
let reloading = null;

/**
 * Reload both settings tables and swap the snapshot atomically.
 * Concurrent callers share one in-flight reload.
 */
async function reload() {
    if (reloading) return reloading;

    reloading = (async () => {
        const [version, globals, events] = await Promise.all([
            store.readVersion(),
            store.loadGlobals(),
            store.loadEvents(),
        ]);
        snapshot = Object.freeze({
            version,
            globals: Object.freeze(globals),
            events: Object.freeze(events),
            loadedAt: new Date(),
        });
        return snapshot;
    })();

    try {
        return await reloading;
    } finally {
        reloading = null;
    }
}

/**
 * The hot path. Never queries; never throws.
 * @returns {{version:number, globals:Object, events:Object, loadedAt:Date}}
 */
function current() {
    if (!snapshot) {
        // Fail closed but coherent: if start() has not run, behave as though
        // everything is disabled rather than crashing a request handler.
        return Object.freeze({
            version: 0,
            globals: Object.freeze(require('./defaults').buildDefaults()),
            events: Object.freeze(Object.create(null)),
            loadedAt: new Date(0),
        });
    }
    return snapshot;
}

/**
 * Read one global setting.
 * @param {string} key
 * @param {*} [fallback]
 */
function get(key, fallback = undefined) {
    const g = current().globals;
    return key in g ? g[key] : fallback;
}

/**
 * Effective settings for one event, or null if the registry does not know it.
 * @param {string} eventKey
 */
function forEvent(eventKey) {
    return current().events[eventKey] || null;
}

/** Force an immediate reload — used right after a settings write. */
async function refreshNow() {
    await reload();
    publishVersion().catch(() => {});
    return snapshot;
}

/** Tell other processes to refresh, when Redis is available. */
async function publishVersion() {
    if (!process.env.REDIS_URL || !snapshot) return;
    try {
        const { getPublisher } = require('../queue/redisClient');
        const pub = getPublisher();
        if (pub) await pub.publish('lms:email:settings-version', String(snapshot.version));
    } catch (_) {
        // Redis is an optimisation here — never let it break a settings write.
    }
}

async function subscribeIfRedis() {
    if (!process.env.REDIS_URL) return;
    try {
        const { createSubscriber } = require('../queue/redisClient');
        redisSub = createSubscriber();
        if (!redisSub) return;
        await redisSub.subscribe('lms:email:settings-version');
        redisSub.on('message', (_channel, payload) => {
            if (Number(payload) !== current().version) reload().catch(() => {});
        });
        console.log('[emailSettings] subscribed to Redis invalidation channel.');
    } catch (err) {
        console.warn('[emailSettings] Redis subscribe failed, polling only:', err.message);
    }
}

/**
 * Load once, then poll the version counter.
 * Safe to call more than once.
 */
async function start() {
    await reload();

    if (!timer) {
        timer = setInterval(async () => {
            try {
                const version = await store.readVersion();
                if (version !== current().version) await reload();
            } catch (err) {
                // A transient DB blip must not kill the process — keep serving
                // the last good snapshot and try again next tick.
                console.warn('[emailSettings] version poll failed:', err.message);
            }
        }, POLL_MS);
        // Never hold the process open during shutdown.
        if (typeof timer.unref === 'function') timer.unref();
    }

    await subscribeIfRedis();

    const g = current().globals;
    console.log(
        `[emailSettings] loaded v${current().version} — mode=${g['global.mode']} ` +
        `enabled=${g['global.enabled']} poll=${POLL_MS}ms`
    );
    return snapshot;
}

async function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    if (redisSub) {
        try { await redisSub.quit(); } catch (_) { /* already gone */ }
        redisSub = null;
    }
}

module.exports = { start, stop, reload, refreshNow, current, get, forEvent };
