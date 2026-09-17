'use strict';

/**
 * In-app notification event contract.
 *
 * Every event is validated at require time. A malformed definition throws on
 * boot rather than at send time, months later, in front of a parent.
 *
 * This is deliberately separate from emails/registry. The two channels answer
 * different questions — an email needs a template, a fan-out mode and a dedup
 * scope; a bell notification needs a title and a priority — and coupling them
 * would mean one channel's schema constrains the other's.
 */

const CATEGORIES = [
    'academics',   // assignments, quizzes, lesson content, feedback
    'classes',     // scheduling, attendance, sessions, leave
    'payments',    // fees, invoices, receipts, auto-pay
    'salary',      // teacher pay
    'accounts',    // passwords, activation, plans, enrolment
    'approvals',   // things waiting on an admin
    'reminders',   // time-based nudges
    'system',      // announcements, support, security alerts
];

const AUDIENCES = ['student', 'parent', 'teacher', 'admin'];

const PRIORITIES = ['critical', 'warning', 'info'];

/**
 * @typedef {Object} NotificationEvent
 * @property {string}   key            '<category>.<snake_verb>' — immutable, it is the DB primary key
 * @property {string}   category
 * @property {string}   label          Human title shown in the admin toggle UI
 * @property {string}   description    One sentence: who gets this and when
 * @property {boolean}  transactional  true -> cannot be switched off in the UI or the API
 * @property {boolean}  defaultEnabled Seed value only; never re-applied on later boots
 * @property {string[]} audiences      Everyone this event can reach
 * @property {string}   priority       Drives the bell's colour and icon fallback
 * @property {string[]} titles         The notification titles this event emits, for the icon check
 */

const REQUIRED_STRINGS = ['key', 'category', 'label', 'description'];

/**
 * @param {NotificationEvent} evt
 * @throws {Error} on any malformed field
 */
function validateEvent(evt) {
    const where = evt && evt.key ? `event "${evt.key}"` : 'an unnamed event';

    for (const field of REQUIRED_STRINGS) {
        if (typeof evt[field] !== 'string' || !evt[field].trim()) {
            throw new Error(`[notificationRegistry] ${where}: "${field}" must be a non-empty string.`);
        }
    }
    if (!/^[a-z_]+\.[a-z0-9_]+$/.test(evt.key)) {
        throw new Error(`[notificationRegistry] ${where}: key must look like "category.snake_verb".`);
    }
    if (!CATEGORIES.includes(evt.category)) {
        throw new Error(`[notificationRegistry] ${where}: unknown category "${evt.category}".`);
    }
    if (!Array.isArray(evt.audiences) || evt.audiences.length === 0) {
        throw new Error(`[notificationRegistry] ${where}: audiences must be a non-empty array.`);
    }
    for (const a of evt.audiences) {
        if (!AUDIENCES.includes(a)) {
            throw new Error(`[notificationRegistry] ${where}: unknown audience "${a}".`);
        }
    }
    if (!PRIORITIES.includes(evt.priority)) {
        throw new Error(`[notificationRegistry] ${where}: unknown priority "${evt.priority}".`);
    }
    if (typeof evt.defaultEnabled !== 'boolean') {
        throw new Error(`[notificationRegistry] ${where}: defaultEnabled must be a boolean.`);
    }
    if (evt.transactional && !evt.defaultEnabled) {
        // A transactional event cannot be re-enabled from the UI, so shipping it
        // disabled would strand it permanently off.
        throw new Error(`[notificationRegistry] ${where}: transactional events must default to enabled.`);
    }
    if (!Array.isArray(evt.titles) || evt.titles.length === 0) {
        throw new Error(`[notificationRegistry] ${where}: titles must list the notification titles this event emits.`);
    }
    return evt;
}

/**
 * Fill in the optional fields so consumers never branch on undefined.
 * @param {Partial<NotificationEvent>} evt
 * @returns {NotificationEvent}
 */
function defineEvent(evt) {
    return validateEvent({
        transactional: false,
        defaultEnabled: true,
        priority: 'info',
        titles: [],
        seedVersion: 1,
        ...evt,
    });
}

module.exports = { CATEGORIES, AUDIENCES, PRIORITIES, defineEvent, validateEvent };
