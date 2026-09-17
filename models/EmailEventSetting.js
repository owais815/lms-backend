const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

/**
 * Per-event admin override. One row per key in emails/registry.
 *
 * The registry — not this table — owns an event's identity, audience, template
 * and payload shape, because those are code contracts that must ship atomically
 * with the controller that fires them. This table stores only the operational
 * decisions that must survive a deploy: the on/off switch, an optional audience
 * subset, and per-event config (reminder lead times, digest hour).
 *
 * `audiences` and `config` are NULL when unchanged and shallow-merged over the
 * registry defaults at read time. That is what lets a new tunable be added in
 * code and apply everywhere it has not been overridden, with no data migration.
 */
const EmailEventSetting = sequelize.define('EmailEventSetting', {
    // Natural key — the registry owns identity, so no autoincrement id.
    eventKey: {
        type: Sequelize.STRING(80),
        allowNull: false,
        primaryKey: true,
    },
    enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    // Subset of the registry's audiences. NULL = all of them.
    audiences: {
        type: Sequelize.JSON,
        allowNull: true,
    },
    // Shallow-merged over the registry's `config`. NULL = registry defaults.
    config: {
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
    tableName: 'EmailEventSettings',
    timestamps: true,
});

module.exports = EmailEventSetting;
