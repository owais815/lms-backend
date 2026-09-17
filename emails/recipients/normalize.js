'use strict';

/**
 * Role casing, email validation and recipient dedup.
 *
 * This codebase is inconsistent about userType casing: the JWT and
 * req.userType use 'ADMIN' / 'TEACHER' / 'STUDENT' / 'PARENT', while
 * Notification.userType rows are written lowercase by utils/notify.js.
 *
 * The email subsystem is canonically LOWERCASE everywhere — matching what
 * notify() already writes — and converts up only at the JWT boundary. This
 * deliberately does not try to fix the existing inconsistency, which is a
 * separate and riskier migration; nothing here ever compares a stored
 * Notification.userType against a JWT value, so both conventions can coexist.
 */

const ROLES = ['student', 'parent', 'teacher', 'admin'];

/**
 * 'ADMIN' | 'Admin' | 'admin' -> 'admin'
 * @param {string} v
 * @returns {string|null}
 */
function toCanonicalRole(v) {
    const lower = String(v || '').trim().toLowerCase();
    if (lower === 'super_admin') return 'admin';
    return ROLES.includes(lower) ? lower : null;
}

/**
 * 'admin' -> 'ADMIN', for comparisons against req.userType.
 * @param {string} v
 */
function toJwtUserType(v) {
    const role = toCanonicalRole(v);
    return role ? role.toUpperCase() : null;
}

/**
 * Deliberately permissive — this rejects obvious junk (empty, no @, spaces,
 * no dot in the domain) without trying to out-guess RFC 5322. Anything that
 * survives this and is still undeliverable will hard-bounce and land in
 * EmailSuppressions, which is the correct place to learn that.
 *
 * @param {string} email
 */
function isValidEmail(email) {
    const v = String(email || '').trim();
    if (!v || v.length > 254) return false;
    if (/\s/.test(v)) return false;
    return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(v);
}

/** Canonical form used for dedup keys and suppression lookups. */
function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

/**
 * Collapse a recipient list by email address, case-insensitively.
 *
 * Whichever entry came first wins, and resolvers are ordered so that a
 * database-backed record precedes an env-sourced address. That matters for
 * admins: if ADMIN_ALERT_EMAILS contains an address that also belongs to a real
 * admin row, the DB record wins so the email and the in-app notification
 * correlate to the same person.
 *
 * @param {Array<{email:string}>} recipients
 */
function dedupeRecipients(recipients) {
    const seen = new Set();
    const out = [];
    for (const r of recipients) {
        if (!r || !isValidEmail(r.email)) continue;
        const key = normalizeEmail(r.email);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ ...r, email: r.email.trim() });
    }
    return out;
}

module.exports = {
    ROLES,
    toCanonicalRole,
    toJwtUserType,
    isValidEmail,
    normalizeEmail,
    dedupeRecipients,
};
