const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

/**
 * Per-event admin override for in-app notifications. One row per key in
 * notifications/registry.
 *
 * The registry — not this table — owns an event's identity, audience list and
 * priority, because those are code contracts that ship with the controller that
 * fires them. This table stores only the operational decisions that must
 * survive a deploy: the on/off switch and an optional audience subset.
 *
 * `audiences` is NULL when unchanged and falls back to the registry's list at
 * read time. That is what lets a new audience be added in code and apply
 * everywhere it has not been explicitly narrowed, with no data migration.
 */
const NotificationEventSetting = sequelize.define('NotificationEventSetting', {
    // Natural key — the registry owns identity, so no autoincrement id.
    eventKey: {
        type: Sequelize.STRING(80),
        allowNull: false,
        primaryKey: true,
    },
    enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    // Subset of the registry's audiences. NULL = all of them.
    audiences: {
        type: Sequelize.JSON,
        allowNull: true,
    },
    // Lets a later boot backfill a newly-required field without touching
    // `enabled`. Bumped in the registry entry, never by the admin UI.
    seededVersion: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
    updatedByAdminId: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
}, {
    tableName: 'NotificationEventSettings',
    timestamps: true,
});

module.exports = NotificationEventSetting;
