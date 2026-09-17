'use strict';

/**
 * The in-app notification registry: one frozen, code-owned source of truth.
 *
 * The send path, the settings API and the admin UI all read this same array.
 * The database stores only *overrides* keyed by eventKey, because an event's
 * audience and identity are code contracts that ship with the controller that
 * fires them, while the on/off switch is an operational decision that has to
 * survive a deploy.
 *
 * Duplicate keys and malformed definitions throw at require time. A registry
 * that loads is a registry every consumer can trust.
 */

const { CATEGORIES } = require('./schema');
const EVENTS = require('./events');

/** @type {Record<string, import('./schema').NotificationEvent>} */
const BY_KEY = Object.create(null);

/** @type {Record<string, string>} lowercased title -> eventKey */
const BY_TITLE = Object.create(null);

for (const evt of EVENTS) {
    if (BY_KEY[evt.key]) {
        throw new Error(
            `[notificationRegistry] duplicate event key "${evt.key}" — keys are database ` +
            `primary keys and must be unique.`
        );
    }
    BY_KEY[evt.key] = Object.freeze(evt);

    for (const title of evt.titles) {
        const t = title.toLowerCase();
        if (BY_TITLE[t] && BY_TITLE[t] !== evt.key) {
            throw new Error(
                `[notificationRegistry] title "${title}" is claimed by both ` +
                `"${BY_TITLE[t]}" and "${evt.key}" — a title must map to one event.`
            );
        }
        BY_TITLE[t] = evt.key;
    }
}

const ALL = Object.freeze(EVENTS.map((e) => Object.freeze(e)));

/** @param {string} key */
const getEvent = (key) => BY_KEY[key] || null;

/**
 * Best-effort reverse lookup, used by call sites that have not been given an
 * explicit eventKey yet. Exact match first, then a prefix match so a title like
 * "Announcement: Term starts" resolves to the "Announcement" event.
 * @param {string} title
 */
function getEventKeyForTitle(title) {
    if (!title) return null;
    const t = String(title).toLowerCase();
    if (BY_TITLE[t]) return BY_TITLE[t];
    for (const known of Object.keys(BY_TITLE)) {
        if (t.startsWith(known)) return BY_TITLE[known];
    }
    return null;
}

/** Events grouped by category, in the order CATEGORIES declares. */
function grouped() {
    return CATEGORIES
        .map((category) => ({
            category,
            events: ALL.filter((e) => e.category === category),
        }))
        .filter((g) => g.events.length > 0);
}

module.exports = { ALL, CATEGORIES, getEvent, getEventKeyForTitle, grouped };
