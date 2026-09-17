const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

/**
 * Exactly one row, id = 1. `version` is bumped in the same write as any
 * settings change.
 *
 * This is the cross-process cache-invalidation signal: every process polls this
 * single primary-key read every EMAIL_SETTINGS_POLL_MS and reloads the full
 * settings snapshot only when the number moved. One tiny query every 15s per
 * process is nothing; querying settings on the send path would not be.
 *
 * When Redis is present a pub/sub channel cuts invalidation latency to ~1ms,
 * but the poll stays as the fallback — a settings system that stops working
 * when Redis is absent would not be acceptable, and 15s of staleness on an
 * email toggle is operationally irrelevant.
 */
const EmailSettingsMeta = sequelize.define('EmailSettingsMeta', {
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
    tableName: 'EmailSettingsMeta',
    timestamps: true,
});

module.exports = EmailSettingsMeta;
