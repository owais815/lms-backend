'use strict';

/**
 * Token bucket protecting the SMTP relay's quota.
 *
 * Applies BACKPRESSURE rather than dropping: when the bucket is empty the
 * processor waits instead of failing jobs. Because the queue is durable, a
 * burst of 500 emails simply takes nine minutes instead of blowing the quota
 * and getting the domain rate-limited.
 *
 * This is per-process, which is correct at instances:1. For multiple workers,
 * swap take() for a Redis INCR+EXPIRE or an EmailThrottle row keyed by minute
 * bucket -- the interface is deliberately narrow enough for that to be a
 * one-file change.
 */

let tokens = 0;
let capacity = 60;
let lastRefill = Date.now();

/** @param {number} perMinute */
function configure(perMinute) {
    const next = Math.max(1, Number(perMinute) || 60);
    if (next !== capacity) {
        capacity = next;
        tokens = Math.min(tokens, capacity);
    }
}

function refill() {
    const now = Date.now();
    const elapsed = now - lastRefill;
    if (elapsed <= 0) return;
    // Continuous refill rather than a per-minute reset, so a steady stream is
    // not forced into 60-second sawtooth bursts.
    tokens = Math.min(capacity, tokens + (elapsed / 60_000) * capacity);
    lastRefill = now;
}

/**
 * Take one token, waiting if necessary.
 * @param {{signal?:{aborted:boolean}}} [opts]
 * @returns {Promise<void>}
 */
async function take(opts = {}) {
    for (;;) {
        refill();
        if (tokens >= 1) {
            tokens -= 1;
            return;
        }
        if (opts.signal && opts.signal.aborted) return;
        // Time until the next whole token, clamped so we never busy-spin.
        const waitMs = Math.max(50, Math.ceil(((1 - tokens) / capacity) * 60_000));
        await new Promise((r) => setTimeout(r, Math.min(waitMs, 5000)));
    }
}

/** For the admin status panel. */
function headroom() {
    refill();
    return { capacityPerMinute: capacity, available: Math.floor(tokens) };
}

module.exports = { configure, take, headroom };
