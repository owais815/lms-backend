'use strict';

/**
 * Retry timing and the retryable/permanent decision.
 *
 * Retrying a permanent failure is not merely wasted work: repeatedly hammering
 * a relay with mail for an address it has already rejected with a 550 is how a
 * sending domain earns a reputation problem.
 */

/**
 * Exponential backoff with jitter, capped at an hour.
 *
 * The jitter matters because failures arrive in batches — if the SMTP host
 * goes down, every in-flight job fails within the same second and would
 * otherwise retry in lockstep forever.
 *
 * @param {number} attempt 1-based
 * @returns {number} milliseconds
 */
function backoffMs(attempt) {
    const base = Math.min(2 ** Math.max(0, attempt - 1) * 30_000, 3_600_000);
    const jitter = Math.random() * base * 0.25;
    return Math.round(base + jitter);
}

/** SMTP/nodemailer error codes that will never succeed on retry. */
const PERMANENT_CODES = new Set([
    'EAUTH',        // bad credentials — retrying cannot fix it
    'EENVELOPE',    // malformed from/to
    'EMESSAGEID',
]);

const PERMANENT_RESPONSE = /^5[0-9][0-9]/;      // 5xx = permanent per RFC 5321
const MAILBOX_GONE = /(no such user|user unknown|mailbox unavailable|does not exist|recipient rejected|address rejected)/i;

/**
 * @param {Error & {code?:string, responseCode?:number, response?:string}} err
 * @returns {{retryable:boolean, code:string, permanentReason:string|null}}
 */
function classify(err) {
    const code = err.code || (err.responseCode ? `SMTP-${err.responseCode}` : 'UNKNOWN');
    const response = String(err.response || err.message || '');

    if (PERMANENT_CODES.has(err.code)) {
        return { retryable: false, code, permanentReason: 'permanent_smtp_error' };
    }
    if (err.responseCode && PERMANENT_RESPONSE.test(String(err.responseCode))) {
        return {
            retryable: false,
            code,
            permanentReason: MAILBOX_GONE.test(response) ? 'hard_bounce' : 'permanent_smtp_error',
        };
    }
    if (MAILBOX_GONE.test(response)) {
        return { retryable: false, code, permanentReason: 'hard_bounce' };
    }

    // Everything else — connection resets, timeouts, 4xx greylisting — is worth
    // another go.
    return { retryable: true, code, permanentReason: null };
}

module.exports = { backoffMs, classify };
