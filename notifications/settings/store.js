'use strict';

/**
 * Typed read/write over NotificationEventSettings.
 *
 * Writes here are the only place that bumps the version counter, which is how
 * every other process learns its cached snapshot is stale.
 */

const sequelize = require('../../utils/database');
const NotificationEventSetting = require('../../models/NotificationEventSetting');
const registry = require('../registry');

const META_TABLE = 'NotificationSettingsMeta';

/**
 * Every event's effective settings: registry defaults with the DB row's
 * overrides layered on top.
 *
 * @returns {Promise<Record<string, {enabled:boolean, audiences:string[]}>>}
 */
async function loadEvents() {
    const rows = await NotificationEventSetting.findAll({
        attributes: ['eventKey', 'enabled', 'audiences'],
    });
    const byKey = new Map(rows.map((r) => [r.eventKey, r]));

    /** @type {Record<string, {enabled:boolean, audiences:string[]}>} */
    const out = Object.create(null);
    for (const evt of registry.ALL) {
        const row = byKey.get(evt.key);
        out[evt.key] = {
            // A transactional event ignores the stored flag entirely: it cannot
            // be switched off from the UI, so a stale `false` in the database
            // (from before an event was marked transactional) must not silently
            // suppress a security or receipt notification.
            enabled: evt.transactional ? true : (row ? !!row.enabled : evt.defaultEnabled),
            audiences: evt.transactional
                ? evt.audiences
                : ((row && row.audiences) || evt.audiences),
        };
    }
    return out;
}

/** @returns {Promise<number>} the current settings version */
async function readVersion() {
    const [rows] = await sequelize.query(
        'SELECT `version` FROM `' + META_TABLE + '` WHERE `id` = 1'
    );
    return Number(rows?.[0]?.version || 0);
}

/**
 * Bump the version counter so other processes reload on their next poll.
 * @param {import('sequelize').Transaction} [transaction]
 */
async function bumpVersion(transaction) {
    await sequelize.query(
        'INSERT INTO `' + META_TABLE + '` (`id`, `version`, `createdAt`, `updatedAt`) ' +
        'VALUES (1, 1, NOW(), NOW()) ' +
        'ON DUPLICATE KEY UPDATE `version` = `version` + 1, `updatedAt` = NOW()',
        { transaction }
    );
}

/**
 * Persist per-event overrides.
 *
 * Transactional events silently ignore an `enabled` change and an `audiences`
 * narrowing — the UI renders their toggle disabled, but the API must not trust
 * the client to enforce that.
 *
 * @param {{eventKey:string, enabled?:boolean, audiences?:string[]|null}[]} updates
 * @param {number|null} adminId
 * @returns {Promise<{written:number, skipped:string[]}>}
 */
async function saveEvents(updates, adminId = null) {
    let written = 0;
    const skipped = [];

    await sequelize.transaction(async (transaction) => {
        for (const upd of updates) {
            const evt = registry.getEvent(upd.eventKey);
            if (!evt) {
                skipped.push(upd.eventKey);
                continue; // unknown key: ignore rather than 500
            }
            if (evt.transactional) {
                skipped.push(upd.eventKey);
                continue;
            }

            const fields = { updatedByAdminId: adminId };
            if (typeof upd.enabled === 'boolean') {
                fields.enabled = upd.enabled;
            }
            if (upd.audiences !== undefined) {
                // Only audiences the event actually declares, so a crafted
                // request cannot widen delivery beyond the code contract.
                fields.audiences = Array.isArray(upd.audiences)
                    ? upd.audiences.filter((a) => evt.audiences.includes(a))
                    : null;
            }

            const [count] = await NotificationEventSetting.update(fields, {
                where: { eventKey: upd.eventKey },
                transaction,
            });

            if (count === 0) {
                // Row missing (event added since the last boot seed).
                await NotificationEventSetting.create(
                    {
                        eventKey: upd.eventKey,
                        enabled: fields.enabled ?? evt.defaultEnabled,
                        audiences: fields.audiences ?? null,
                        seededVersion: evt.seedVersion || 1,
                        updatedByAdminId: adminId,
                    },
                    { transaction }
                );
            }
            written += 1;
        }
        await bumpVersion(transaction);
    });

    return { written, skipped };
}

module.exports = { loadEvents, readVersion, bumpVersion, saveEvents };
