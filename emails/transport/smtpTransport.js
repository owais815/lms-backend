'use strict';

/**
 * Pooled nodemailer SMTP transport.
 *
 * Credentials come from env only — never the database. See the reasoning in
 * emails/settings/defaults.js.
 *
 * Follows the conventions set by services/callingAppService.js: strict mode,
 * env constants read at module load, formatted errors thrown to the caller.
 */

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
// Port 465 is implicit TLS; 587 uses STARTTLS and must be `secure: false`.
const SMTP_SECURE = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

let transporter = null;

function isConfigured() {
    return Boolean(SMTP_HOST);
}

function get() {
    if (transporter) return transporter;
    if (!isConfigured()) {
        throw new Error('SMTP is not configured — set SMTP_HOST (and SMTP_USER/SMTP_PASS if the relay requires auth).');
    }

    // eslint-disable-next-line global-require
    const nodemailer = require('nodemailer');

    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        ...(SMTP_USER ? { auth: { user: SMTP_USER, pass: SMTP_PASS } } : {}),

        // Connection reuse: opening a TLS handshake per message is slow and
        // some relays throttle connection churn harder than message volume.
        pool: true,
        maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || 2),
        maxMessages: Number(process.env.SMTP_MAX_MESSAGES || 100),

        // A transport-level ceiling independent of the application throttle, so
        // a bug in emails/throttle.js cannot turn into an SMTP ban.
        rateDelta: 60_000,
        rateLimit: Number(process.env.SMTP_RATE_LIMIT || 60),

        connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 15_000),
        greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 10_000),
        socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 30_000),
    });

    return transporter;
}

/**
 * @param {Object} message nodemailer message object
 * @returns {Promise<{messageId:string, accepted:string[], rejected:string[]}>}
 */
async function send(message) {
    const info = await get().sendMail(message);
    return {
        messageId: info.messageId,
        accepted: info.accepted || [],
        rejected: info.rejected || [],
    };
}

/** Probe the connection — used at worker boot to fail loudly and early. */
async function verify() {
    if (!isConfigured()) throw new Error('SMTP_HOST is not set.');
    return get().verify();
}

async function close() {
    if (transporter) {
        transporter.close();
        transporter = null;
    }
}

module.exports = { send, verify, close, isConfigured, name: 'smtp' };
