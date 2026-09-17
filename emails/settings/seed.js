'use strict';

/**
 * Idempotent settings seeding. Runs at API boot, before the server starts.
 *
 * The one rule that matters: INSERT IGNORE only. Never UPDATE, never upsert,
 * never findOrCreate with defaults re-applied on find. `defaultEnabled` in the
 * registry is a *seed* value, not a desired state — once an admin has toggled
 * an event, that decision is theirs and no later deploy may overwrite it.
 *
 * Events removed from the registry are never deleted either. A seeder that
 * deletes rows is a seeder that will one day delete the wrong rows; orphans are
 * simply ignored at read time and surfaced in the UI for manual cleanup.
 */

const sequelize = require('../../utils/database');
const registry = require('../registry');
const store = require('./store');

/**
 * @returns {Promise<{inserted:number, freshInstall:boolean}>}
 */
async function seedEmailSettings() {
    // A brand-new database must never be able to send historical mail, so we
    // detect emptiness *before* inserting anything.
    const [countRows] = await sequelize.query(
        'SELECT COUNT(*) AS n FROM `EmailEventSettings`'
    );
    const freshInstall = Number(countRows?.[0]?.n || 0) === 0;

    let inserted = 0;
    for (const evt of registry.ALL) {
        const [result] = await sequelize.query(
            'INSERT IGNORE INTO `EmailEventSettings` ' +
            '(`eventKey`, `enabled`, `audiences`, `config`, `seededVersion`, `createdAt`, `updatedAt`) ' +
            'VALUES (?, ?, NULL, NULL, ?, NOW(), NOW())',
            { replacements: [evt.key, evt.defaultEnabled ? 1 : 0, evt.seedVersion || 1] }
        );
        if (result && result.affectedRows) inserted += result.affectedRows;
    }

    // Ensure the version row exists so the cache poll has something to read.
    await sequelize.query(
        'INSERT IGNORE INTO `EmailSettingsMeta` (`id`, `version`, `createdAt`, `updatedAt`) ' +
        'VALUES (1, 1, NOW(), NOW())'
    );

    if (freshInstall) {
        // Pin the go-live instant so that on the very first run, every event
        // that "occurred" before this moment is dropped by the dispatcher.
        // Without this, the first overdue-fees cron would mail every historical
        // overdue fee in the database at once.
        await sequelize.query(
            'INSERT IGNORE INTO `EmailSettings` (`settingKey`, `value`, `createdAt`, `updatedAt`) ' +
            'VALUES (?, ?, NOW(), NOW())',
            {
                replacements: [
                    'global.goLiveAt',
                    JSON.stringify({ v: new Date().toISOString() }),
                ],
            }
        );
        await sequelize.query(
            'INSERT IGNORE INTO `EmailSettings` (`settingKey`, `value`, `createdAt`, `updatedAt`) ' +
            'VALUES (?, ?, NOW(), NOW())',
            { replacements: ['global.mode', JSON.stringify({ v: 'log' })] }
        );
    }

    if (inserted > 0) {
        await store.bumpVersion();
        console.log(
            `[emailSettings] seeded ${inserted} event row(s)` +
            (freshInstall ? ' (fresh install — mode pinned to "log").' : '.')
        );
    }

    return { inserted, freshInstall };
}

module.exports = { seedEmailSettings };
