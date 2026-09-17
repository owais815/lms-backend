'use strict';

/**
 * The event registry: one frozen, code-owned source of truth.
 *
 * Backend dispatch, the settings API and the admin UI all read this same
 * array. The database stores only *overrides* keyed by eventKey, because an
 * event's audience, template and payload shape are code contracts that must
 * ship atomically with the controller that fires them, while the on/off switch
 * is an operational decision that has to survive a deploy.
 *
 * Duplicate keys and malformed definitions throw at require time. A registry
 * that loads successfully is a registry every consumer can trust.
 */

const { CATEGORIES } = require('./schema');

const MODULES = [
    require('./payments'),
    require('./salary'),
    require('./accounts'),
    require('./classes'),
    require('./academics'),
    require('./approvals'),
    require('./reminders'),
    require('./digests'),
];

/** @type {Record<string, import('./schema').EmailEvent>} */
const BY_KEY = Object.create(null);

for (const mod of MODULES) {
    for (const evt of mod) {
        if (BY_KEY[evt.key]) {
            throw new Error(
                `[emailRegistry] duplicate event key "${evt.key}" — keys are database ` +
                `primary keys and must be unique across every category module.`
            );
        }
        BY_KEY[evt.key] = Object.freeze(evt);
    }
}

Object.freeze(BY_KEY);

const ALL = Object.freeze(Object.values(BY_KEY));
const KEYS = Object.freeze(Object.keys(BY_KEY));

/**
 * @param {string} key
 * @returns {import('./schema').EmailEvent|undefined}
 */
function getEvent(key) {
    return BY_KEY[key];
}

/**
 * @param {string} category
 * @returns {import('./schema').EmailEvent[]}
 */
function byCategory(category) {
    return ALL.filter((e) => e.category === category);
}

/**
 * Registry grouped for the admin UI, in a stable category order so toggles
 * never jump around between page loads.
 * @returns {{category:string, events:import('./schema').EmailEvent[]}[]}
 */
function grouped() {
    return CATEGORIES
        .map((category) => ({ category, events: byCategory(category) }))
        .filter((g) => g.events.length > 0);
}

module.exports = { ALL, KEYS, BY_KEY, getEvent, byCategory, grouped, CATEGORIES };
