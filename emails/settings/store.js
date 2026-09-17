'use strict';

/**
 * Typed read/write over EmailSettings + EmailEventSettings.
 *
 * Writes here are the only place that bumps EmailSettingsMeta.version, which is
 * how every other process learns its cached snapshot is stale.
 */

const sequelize = require('../../utils/database');
const EmailSetting = require('../../models/EmailSetting');
const EmailEventSetting = require('../../models/EmailEventSetting');
const EmailSettingsMeta = require('../../models/EmailSettingsMeta');
const registry = require('../registry');
const { buildDefaults } = require('./defaults');

/**
 * Read every global setting, DB rows layered over env defaults.
 * @returns {Promise<Record<string, any>>}
 */
async function loadGlobals() {
    const resolved = buildDefaults();
    const rows = await EmailSetting.findAll({ attributes: ['settingKey', 'value'] });
    for (const row of rows) {
        // Values are stored wrapped ({ v: ... }) so scalars are legal JSON.
        const wrapped = row.value;
        if (wrapped && typeof wrapped === 'object' && 'v' in wrapped) {
            resolved[row.settingKey] = wrapped.v;
        }
    }
    return resolved;
}

/**
 * Read every event's effective settings: registry defaults with the DB row's
 * overrides shallow-merged on top.
 *
 * `audiences` and `config` stored as NULL mean "registry default", which is
 * what lets a new tunable be added in code and apply everywhere it has not been
 * explicitly overridden — no data migration, no backfill.
 *
 * @returns {Promise<Record<string, {enabled:boolean, audiences:string[], config:Object}>>}
 */
async function loadEvents() {
    const rows = await EmailEventSetting.findAll({
        attributes: ['eventKey', 'enabled', 'audiences', 'config'],
    });
    const byKey = new Map(rows.map((r) => [r.eventKey, r]));

    /** @type {Record<string, any>} */
    const out = Object.create(null);
    for (const evt of registry.ALL) {
        const row = byKey.get(evt.key);
        out[evt.key] = {
            // A transactional event ignores the stored flag entirely: it cannot
            // be switched off from the UI, so a stale `false` in the database
            // (from before an event was marked transactional) must not silently
            // suppress it.
            enabled: evt.transactional ? true : (row ? !!row.enabled : evt.defaultEnabled),
            audiences: (row && row.audiences) || evt.audiences,
            config: { ...evt.config, ...((row && row.config) || {}) },
        };
    }
    return out;
}

/** @returns {Promise<number>} the current settings version */
async function readVersion() {
    const [rows] = await sequelize.query(
        'SELECT `version` FROM `EmailSettingsMeta` WHERE `id` = 1'
    );
    return Number(rows?.[0]?.version || 0);
}

/**
 * Bump the version counter. Called inside every write so other processes
 * notice on their next poll.
 * @param {import('sequelize').Transaction} [transaction]
 */
async function bumpVersion(transaction) {
    await sequelize.query(
        'INSERT INTO `EmailSettingsMeta` (`id`, `version`, `createdAt`, `updatedAt`) ' +
        'VALUES (1, 1, NOW(), NOW()) ' +
        'ON DUPLICATE KEY UPDATE `version` = `version` + 1, `updatedAt` = NOW()',
        { transaction }
    );
}

/**
 * Persist global settings. Unknown keys are rejected rather than stored, so a
 * typo in a request body cannot quietly create a setting nobody reads.
 *
 * @param {Record<string, any>} patch
 * @param {number|null} adminId
 * @returns {Promise<string[]>} the keys actually written
 */
async function saveGlobals(patch, adminId = null) {
    const known = new Set(Object.keys(buildDefaults()));
    const entries = Object.entries(patch).filter(([k]) => known.has(k));
    if (entries.length === 0) return [];

    await sequelize.transaction(async (transaction) => {
        for (const [settingKey, value] of entries) {
            await EmailSetting.upsert(
                { settingKey, value: { v: value }, updatedByAdminId: adminId },
                { transaction }
            );
        }
        await bumpVersion(transaction);
    });

    return entries.map(([k]) => k);
}

/**
 * Persist per-event overrides.
 *
 * Transactional events silently ignore an `enabled` change — the UI renders
 * their toggle disabled, but the API must not trust the client to enforce that.
 *
 * @param {{eventKey:string, enabled?:boolean, audiences?:string[]|null, config?:Object|null}[]} updates
 * @param {number|null} adminId
 * @returns {Promise<number>} rows written
 */
async function saveEvents(updates, adminId = null) {
    let written = 0;

    await sequelize.transaction(async (transaction) => {
        for (const upd of updates) {
            const evt = registry.getEvent(upd.eventKey);
            if (!evt) continue; // unknown key: ignore rather than 500

            const fields = { updatedByAdminId: adminId };
            if (typeof upd.enabled === 'boolean' && !evt.transactional) {
                fields.enabled = upd.enabled;
            }
            if (upd.audiences !== undefined) {
                // Only audiences the event actually declares.
                fields.audiences = Array.isArray(upd.audiences)
                    ? upd.audiences.filter((a) => evt.audiences.includes(a))
                    : null;
            }
            if (upd.config !== undefined) {
                fields.config = upd.config || null;
            }

            const [count] = await EmailEventSetting.update(fields, {
                where: { eventKey: upd.eventKey },
                transaction,
            });

            if (count === 0) {
                // Row missing (event added since the last boot seed).
                await EmailEventSetting.create(
                    {
                        eventKey: upd.eventKey,
                        enabled: fields.enabled ?? evt.defaultEnabled,
                        audiences: fields.audiences ?? null,
                        config: fields.config ?? null,
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

    return written;
}

module.exports = {
    loadGlobals,
    loadEvents,
    readVersion,
    bumpVersion,
    saveGlobals,
    saveEvents,
};
