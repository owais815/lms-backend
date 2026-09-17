'use strict';

/**
 * Event definition contract + validation.
 *
 * Every event is validated at boot. A malformed definition throws immediately
 * rather than failing at send time, months later, in front of a parent.
 */

const CATEGORIES = [
    'payments', 'salary', 'accounts', 'classes',
    'academics', 'approvals', 'reminders', 'digests',
];

const AUDIENCES = ['student', 'parent', 'teacher', 'admin'];

const DEDUP_SCOPES = [
    'entity',      // once ever per entity + recipient
    'entity+day',  // at most once per calendar day
    'period',      // caller supplies the bucket (lead time, week, month)
    'always',      // no dedup -- password resets, test sends
];

const FAN_OUT = [
    'per-entity',    // one email per entity (a parent with 2 children gets 2)
    'per-recipient', // one email per person, template loops over the entities
];

/**
 * @typedef {Object} EmailEvent
 * @property {string}   key            '<category>.<snake_verb>' -- immutable, it is the DB primary key
 * @property {string}   category
 * @property {string}   label          Human title shown in the admin toggle UI
 * @property {string}   description    One sentence: who gets this and when
 * @property {boolean}  transactional  true -> cannot be switched off in the UI
 * @property {boolean}  critical       true -> the caller should await the dispatch
 * @property {boolean}  defaultEnabled Seed value only; never re-applied on later boots
 * @property {string[]} audiences
 * @property {string}   fanOut
 * @property {string}   template       Path under emails/templates, no extension
 * @property {string}   entityType     For EmailLog.entityType and the dedup key
 * @property {string}   dedupScope
 * @property {number}   priority       1 security | 2 money | 3 normal | 4 digest
 * @property {Object}   config         Per-event tunables and their defaults
 * @property {Object}   samplePayload  Powers the test-send and the render assertion
 */

const REQUIRED_STRINGS = ['key', 'category', 'label', 'description', 'template', 'entityType'];

/**
 * @param {EmailEvent} evt
 * @throws {Error} on any malformed field
 */
function validateEvent(evt) {
    const where = evt && evt.key ? `event "${evt.key}"` : 'an unnamed event';

    for (const field of REQUIRED_STRINGS) {
        if (typeof evt[field] !== 'string' || !evt[field].trim()) {
            throw new Error(`[emailRegistry] ${where}: "${field}" must be a non-empty string.`);
        }
    }
    if (!/^[a-z_]+\.[a-z0-9_]+$/.test(evt.key)) {
        throw new Error(`[emailRegistry] ${where}: key must look like "category.snake_verb".`);
    }
    if (!CATEGORIES.includes(evt.category)) {
        throw new Error(`[emailRegistry] ${where}: unknown category "${evt.category}".`);
    }
    if (!Array.isArray(evt.audiences) || evt.audiences.length === 0) {
        throw new Error(`[emailRegistry] ${where}: audiences must be a non-empty array.`);
    }
    for (const a of evt.audiences) {
        if (!AUDIENCES.includes(a)) {
            throw new Error(`[emailRegistry] ${where}: unknown audience "${a}".`);
        }
    }
    if (!DEDUP_SCOPES.includes(evt.dedupScope)) {
        throw new Error(`[emailRegistry] ${where}: unknown dedupScope "${evt.dedupScope}".`);
    }
    if (!FAN_OUT.includes(evt.fanOut)) {
        throw new Error(`[emailRegistry] ${where}: unknown fanOut "${evt.fanOut}".`);
    }
    if (!Number.isInteger(evt.priority) || evt.priority < 1 || evt.priority > 4) {
        throw new Error(`[emailRegistry] ${where}: priority must be an integer 1-4.`);
    }
    if (typeof evt.defaultEnabled !== 'boolean') {
        throw new Error(`[emailRegistry] ${where}: defaultEnabled must be a boolean.`);
    }
    if (evt.transactional && !evt.defaultEnabled) {
        // A transactional event cannot be disabled in the UI, so shipping it
        // disabled would leave it permanently off with no way to fix it.
        throw new Error(`[emailRegistry] ${where}: transactional events must default to enabled.`);
    }
    return evt;
}

/**
 * Fill in the optional fields so consumers never branch on undefined.
 * @param {Partial<EmailEvent>} evt
 * @returns {EmailEvent}
 */
function defineEvent(evt) {
    const full = {
        transactional: false,
        critical: false,
        defaultEnabled: false,
        fanOut: 'per-entity',
        dedupScope: 'entity',
        priority: 3,
        config: {},
        samplePayload: {},
        seedVersion: 1,
        ...evt,
    };
    return validateEvent(full);
}

module.exports = { CATEGORIES, AUDIENCES, DEDUP_SCOPES, FAN_OUT, defineEvent, validateEvent };
