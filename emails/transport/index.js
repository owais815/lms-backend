'use strict';

/**
 * Transport selection, keyed on the current mode.
 *
 *   off      nothing reaches here — dispatch short-circuits first
 *   log      renders fully, logs the subject and recipient, opens NO socket
 *   sandbox  real SMTP, but every recipient is rewritten to one test address
 *   live     normal delivery
 *
 * 'log' is the default in every environment, production included. Going live is
 * a deliberate act, not an emergent property of a deploy.
 */

const smtp = require('./smtpTransport');
const logTransport = require('./logTransport');
const memoryTransport = require('./memoryTransport');

/** Mask an address for logs — the full value lives in the DB behind RBAC. */
function maskEmail(email) {
    const [user, domain] = String(email || '').split('@');
    if (!domain) return '***';
    return `${user.slice(0, 1)}***@${domain}`;
}

/**
 * @param {string} mode
 * @returns {{send:Function, verify:Function, close:Function, name:string}}
 */
function forMode(mode) {
    if (process.env.EMAIL_TEST_TRANSPORT === 'memory') return memoryTransport;
    if (mode === 'log') return logTransport;
    return smtp; // 'live' and 'sandbox' both really send
}

/**
 * Rewrite recipients when sandboxed.
 *
 * The original address is preserved in the EmailLog row and prepended to the
 * subject, so a sandbox run is still a readable record of who would have been
 * mailed rather than a pile of identical messages.
 *
 * @param {Object} message
 * @param {string} redirectTo
 */
function applySandbox(message, redirectTo) {
    if (!redirectTo) {
        throw new Error('Sandbox mode is on but global.sandboxRedirectTo / EMAIL_SANDBOX_TO is empty.');
    }
    return {
        ...message,
        to: redirectTo,
        subject: `[→ ${message.to}] ${message.subject}`,
    };
}

async function verify(mode) {
    return forMode(mode).verify();
}

async function close() {
    await smtp.close().catch(() => {});
}

module.exports = { forMode, applySandbox, verify, close, maskEmail, smtp, logTransport, memoryTransport };
