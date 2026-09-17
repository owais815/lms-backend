'use strict';

/**
 * Dry-run transport. Renders everything, sends nothing, opens no socket.
 *
 * This is the default mode, and it is what makes the first deploy of this
 * subsystem safe: you get a full EmailLog of what would have gone out, with
 * real subjects and real recipients, before a single message leaves the box.
 */

let counter = 0;

async function send(message) {
    counter += 1;
    const to = String(message.to || '');
    const masked = to.replace(/^([^@])[^@]*@/, '$1***@');
    console.log(`[emailLog] DRY-RUN to=${masked} subject="${message.subject}"`);
    return {
        messageId: `dry-run-${Date.now()}-${counter}`,
        accepted: [to],
        rejected: [],
    };
}

async function verify() {
    return true;
}

async function close() {}

module.exports = { send, verify, close, name: 'log' };
