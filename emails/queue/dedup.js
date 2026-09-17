'use strict';

/**
 * Deduplication key construction.
 *
 * The key is a hash of (event, entity, recipient, bucket). The bucket is what
 * makes the same logical event repeatable when it should be and idempotent when
 * it should not:
 *
 *   entity      '' .............. once ever — a verified payment, a certificate
 *   entity+day  '2026-03-18' .... at most once a day — an overdue fee
 *   period      'lead:3d' ....... caller-supplied — reminder lead times, digests
 *   always      a random id ..... never deduped — password resets
 *
 * The components are also stored as plain columns on EmailLog, so the key never
 * has to be reversed to work out what it refers to.
 */

const crypto = require('crypto');
const moment = require('moment-timezone');

/**
 * @param {Object} opts
 * @param {string} opts.eventKey
 * @param {string} opts.scope       dedupScope from the registry
 * @param {string} [opts.entityType]
 * @param {number|string} [opts.entityId]
 * @param {string} opts.recipientEmail
 * @param {string} [opts.bucket]    explicit bucket for scope 'period'
 * @param {string} [opts.timezone]  institution timezone, for 'entity+day'
 * @returns {string} 40-char hex
 */
function buildDedupKey({ eventKey, scope, entityType, entityId, recipientEmail, bucket, timezone }) {
    let resolvedBucket = '';

    if (scope === 'entity+day') {
        // Institution timezone, not UTC: a cron running at 00:05 local time must
        // land in the day the operator thinks it is.
        resolvedBucket = moment().tz(timezone || 'Asia/Karachi').format('YYYY-MM-DD');
    } else if (scope === 'period') {
        // Caller must supply one. Falling back to the date would silently turn a
        // per-lead-time reminder into one-per-day and swallow the 3-day notice.
        resolvedBucket = String(bucket || 'default');
    } else if (scope === 'always') {
        resolvedBucket = crypto.randomBytes(12).toString('hex');
    }

    const parts = [
        eventKey,
        entityType || '',
        entityId === undefined || entityId === null ? '' : String(entityId),
        String(recipientEmail || '').trim().toLowerCase(),
        resolvedBucket,
    ];

    return crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 40);
}

/** Bucket helpers, so call sites spell these the same way every time. */
const buckets = {
    /** Reminder lead time in days: 'lead:3d' */
    leadDays: (n) => `lead:${n}d`,
    /** Reminder lead time in minutes: 'lead:60m' */
    leadMinutes: (n) => `lead:${n}m`,
    /**
     * A reminder tied to a specific scheduled moment.
     * Including the scheduled time is what makes a rescheduled class re-notify:
     * moving the class changes the bucket, so it is a genuinely new email rather
     * than a duplicate of the one already sent for the old time.
     */
    scheduled: (date, time, lead) => `at:${String(date).slice(0, 10)}T${String(time || '').slice(0, 5)}|${lead}`,
    /** ISO week: 'week:2026-W12' */
    week: (d) => `week:${moment(d).format('GGGG-[W]WW')}`,
    /** Calendar month: 'month:2026-03' */
    month: (d) => `month:${moment(d).format('YYYY-MM')}`,
    /** Calendar day: 'day:2026-03-18' */
    day: (d) => `day:${moment(d).format('YYYY-MM-DD')}`,
    /** Admin-triggered resend: 'resend:2' */
    resend: (n) => `resend:${n}`,
};

module.exports = { buildDedupKey, buckets };
