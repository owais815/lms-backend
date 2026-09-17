'use strict';

/**
 * Single entry point for "who should receive this event?".
 *
 * Returns both deliverable recipients and the ones that were skipped, because
 * a student with no email on file is a data-quality problem someone should fix
 * — not something to drop silently. The skipped list becomes EmailLog rows with
 * status 'skipped_no_address', which the admin delivery log surfaces.
 */

const registry = require('../registry');
const resolvers = require('./resolvers');
const { dedupeRecipients, isValidEmail, normalizeEmail } = require('./normalize');

/**
 * @typedef {Object} Recipient
 * @property {string} email
 * @property {string} name
 * @property {'student'|'parent'|'teacher'|'admin'} role
 * @property {number|null} userId
 * @property {string|null} timeZone
 * @property {'db'|'env'} source
 */

/**
 * @param {string} eventKey
 * @param {Object} context      the entity bag passed to sendEmailEvent()
 * @param {Object} [options]
 * @param {string[]} [options.audiences]      effective audiences (settings override)
 * @param {string[]} [options.adminEmails]    from global.adminAlertEmails
 * @param {Set<string>} [options.suppressed]  normalized addresses to exclude
 * @returns {Promise<{recipients:Recipient[], skipped:Array, suppressed:Array}>}
 */
async function resolveRecipients(eventKey, context = {}, options = {}) {
    const evt = registry.getEvent(eventKey);
    if (!evt) return { recipients: [], skipped: [], suppressed: [] };

    const audiences = options.audiences || evt.audiences;

    // Callers can bypass resolution entirely — used by the test-send endpoint
    // and by events whose recipient is not reachable from any entity.
    const raw = [];
    if (Array.isArray(context.__recipients)) {
        raw.push(...context.__recipients);
    } else {
        // Sequential rather than parallel: each resolver is a small indexed
        // read, and running them in order keeps the 'db beats env' precedence
        // that dedupeRecipients() relies on.
        for (const audience of audiences) {
            if (audience === 'student') raw.push(...await resolvers.resolveStudents(context));
            else if (audience === 'parent') raw.push(...await resolvers.resolveParents(context));
            else if (audience === 'teacher') raw.push(...await resolvers.resolveTeachers(context));
            else if (audience === 'admin') raw.push(...await resolvers.resolveAdmins(context, options.adminEmails));
        }
    }

    // Anyone without a usable address: recorded, not discarded.
    const skipped = raw.filter((r) => r && !isValidEmail(r.email));

    const deliverable = dedupeRecipients(raw);

    const suppressedSet = options.suppressed || new Set();
    const suppressed = [];
    const recipients = [];
    for (const r of deliverable) {
        if (suppressedSet.has(normalizeEmail(r.email))) suppressed.push(r);
        else recipients.push(r);
    }

    return { recipients, skipped, suppressed };
}

/**
 * Load the current suppression list.
 *
 * Small table, read once per dispatch. If it ever grows past a few thousand
 * rows this should move behind the settings cache, but pre-caching a table
 * that is usually empty would be optimising the wrong thing.
 *
 * @returns {Promise<Set<string>>}
 */
async function loadSuppressions() {
    try {
        const EmailSuppression = require('../../models/EmailSuppression');
        const rows = await EmailSuppression.findAll({ attributes: ['email'] });
        return new Set(rows.map((r) => normalizeEmail(r.email)));
    } catch (err) {
        // A suppression lookup failure must not stop mail going out; the worst
        // case is one email to an address we meant to skip.
        console.warn('[emailRecipients] suppression lookup failed:', err.message);
        return new Set();
    }
}

module.exports = { resolveRecipients, loadSuppressions };
