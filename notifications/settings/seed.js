'use strict';

/**
 * Idempotent settings seeding. Runs at boot, before the server starts.
 *
 * The one rule that matters: INSERT IGNORE only. Never UPDATE, never upsert,
 * never findOrCreate with defaults re-applied on find. `defaultEnabled` in the
 * registry is a *seed* value, not a desired state — once an admin has toggled
 * an event, that decision is theirs and no later deploy may overwrite it.
 *
 * Events removed from the registry are never deleted either. A seeder that
 * deletes rows is a seeder that will one day delete the wrong rows; orphans are
 * ignored at read time and surfaced in the UI for manual cleanup.
 */

const sequelize = require('../../utils/database');
const registry = require('../registry');
const store = require('./store');

/**
 * @returns {Promise<{inserted:number}>}
 */
async function seedNotificationSettings() {
    let inserted = 0;

    for (const evt of registry.ALL) {
        const [result] = await sequelize.query(
            'INSERT IGNORE INTO `NotificationEventSettings` ' +
            '(`eventKey`, `enabled`, `audiences`, `seededVersion`, `createdAt`, `updatedAt`) ' +
            'VALUES (?, ?, NULL, ?, NOW(), NOW())',
            { replacements: [evt.key, evt.defaultEnabled ? 1 : 0, evt.seedVersion || 1] }
        );
        if (result && result.affectedRows) inserted += result.affectedRows;
    }

    // Ensure the version row exists so the cache poll has something to read.
    await sequelize.query(
        'INSERT IGNORE INTO `NotificationSettingsMeta` (`id`, `version`, `createdAt`, `updatedAt`) ' +
        'VALUES (1, 1, NOW(), NOW())'
    );

    if (inserted > 0) {
        await store.bumpVersion();
        console.log(`[notificationSettings] seeded ${inserted} event row(s).`);
    }

    return { inserted };
}

module.exports = { seedNotificationSettings };
