const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

/**
 * Global key/value settings bag for the email subsystem.
 *
 * Holds branding, sender identity, mode, throttle and reminder lead times —
 * everything an admin can change at runtime. SMTP credentials deliberately do
 * NOT live here: the DB is dumped for backups, the worker needs a transport
 * before it can trust the DB, and the deploy workflow rewrites .env wholesale
 * so keeping the whole SMTP tuple in env gives exactly one rotation point.
 *
 * `value` is always a wrapper object ({ v: ... }) so scalars are legal JSON on
 * every MySQL version we might meet.
 *
 * Resolution order everywhere: DB row -> env default -> hardcoded fallback.
 */
const EmailSetting = sequelize.define('EmailSetting', {
    settingKey: {
        type: Sequelize.STRING(80),
        allowNull: false,
        primaryKey: true,
    },
    value: {
        type: Sequelize.JSON,
        allowNull: false,
    },
    updatedByAdminId: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
}, {
    tableName: 'EmailSettings',
    timestamps: true,
});

module.exports = EmailSetting;
