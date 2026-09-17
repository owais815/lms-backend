'use strict';

/**
 * Test transport. Collects messages in an array instead of sending them.
 *
 * Enabled with EMAIL_TEST_TRANSPORT=memory so the full pipeline -- dedup,
 * queue, render, throttle -- can be exercised in a unit test with no network
 * and no Mailpit container.
 */

const sent = [];

async function send(message) {
    sent.push(message);
    return {
        messageId: `memory-${sent.length}`,
        accepted: [message.to],
        rejected: [],
    };
}

async function verify() {
    return true;
}

async function close() {}

/** @returns {Object[]} every message sent since the last reset */
function messages() {
    return sent;
}

function reset() {
    sent.length = 0;
}

module.exports = { send, verify, close, messages, reset, name: 'memory' };
