const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

/**
 * Exactly one row, id = 1. `version` is bumped in the same write as any
 * notification-settings change.
 *
 * This is the cross-process cache-invalidation signal: every process polls this
 * single primary-key read every NOTIFICATION_SETTINGS_POLL_MS and reloads the
 * snapshot only when the number moved. One tiny query every 15s per process is
 * nothing; querying settings on every notify() call would not be.
 */
const NotificationSettingsMeta = sequelize.define('NotificationSettingsMeta', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        defaultValue: 1,
    },
    version: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 1,
    },
}, {
    tableName: 'NotificationSettingsMeta',
    timestamps: true,
});

module.exports = NotificationSettingsMeta;
