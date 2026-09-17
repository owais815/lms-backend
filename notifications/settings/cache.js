'use strict';

/**
 * In-memory settings snapshot for the notification send path.
 *
 * Every notify() call consults this, so it must never query and never throw. It
 * holds a frozen snapshot and refreshes only when the single-row version counter
 * moves — one primary-key read every 15 seconds per process, against a snapshot
 * read that costs nothing.
 *
 * Cross-process invalidation (the API writes, a cron worker must notice) is the
 * version poll. 15 seconds of staleness on a notification toggle is a much
 * better trade than a query on every notification.
 */

const store = require('./store');
const registry = require('../registry');

const POLL_MS = Number(process.env.NOTIFICATION_SETTINGS_POLL_MS || 15000);

/** @type {{version:number, events:Object, loadedAt:Date}|null} */
let snapshot = null;
let timer = null;
let reloading = null;

/** Registry defaults, used before start() has run or if the DB is unreachable. */
function defaultsSnapshot() {
    const events = Object.create(null);
    for (const evt of registry.ALL) {
        events[evt.key] = { enabled: evt.defaultEnabled, audiences: evt.audiences };
    }
    return Object.freeze({
        version: 0,
        events: Object.freeze(events),
        loadedAt: new Date(0),
    });
}

/** Reload and swap the snapshot atomically. Concurrent callers share one reload. */
async function reload() {
    if (reloading) return reloading;

    reloading = (async () => {
        const [version, events] = await Promise.all([
            store.readVersion(),
            store.loadEvents(),
        ]);
        snapshot = Object.freeze({
            version,
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
 * @returns {{version:number, events:Object, loadedAt:Date}}
 */
function current() {
    // Fail OPEN, not closed. If start() has not run — a script, a test, a boot
    // ordering change — the right behaviour is to deliver notifications using
    // registry defaults, not to silently swallow every one of them.
    return snapshot || defaultsSnapshot();
}

/**
 * Should this event reach this audience right now?
 *
 * Unknown keys return true: a notification whose event is not in the registry
 * yet must still be delivered, or adding a call site before its registry entry
 * would silently drop it.
 *
 * @param {string|null} eventKey
 * @param {string} [userType] 'student' | 'parent' | 'teacher' | 'admin'
 * @returns {boolean}
 */
function isEnabled(eventKey, userType) {
    if (!eventKey) return true;
    const eff = current().events[eventKey];
    if (!eff) return true;
    if (!eff.enabled) return false;
    if (!userType) return true;
    return eff.audiences.includes(String(userType).toLowerCase());
}

/** Effective settings for one event, or null if the registry does not know it. */
function forEvent(eventKey) {
    return current().events[eventKey] || null;
}

/** Force an immediate reload — used right after a settings write. */
async function refreshNow() {
    await reload();
    return snapshot;
}

/** Load once, then poll the version counter. Safe to call more than once. */
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
                console.warn('[notificationSettings] version poll failed:', err.message);
            }
        }, POLL_MS);
        if (typeof timer.unref === 'function') timer.unref();
    }

    const enabled = Object.values(current().events).filter((e) => e.enabled).length;
    console.log(
        `[notificationSettings] loaded v${current().version} — ` +
        `${enabled}/${registry.ALL.length} events enabled, poll=${POLL_MS}ms`
    );
    return snapshot;
}

function stop() {
    if (timer) { clearInterval(timer); timer = null; }
}

module.exports = { start, stop, reload, refreshNow, current, isEnabled, forEvent };
