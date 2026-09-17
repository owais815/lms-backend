const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

/**
 * Do-not-send list. Checked during recipient resolution, after dedup and
 * before sandbox redirection.
 *
 * Hard bounces and complaints belong here permanently — continuing to send to
 * an address that has hard-bounced is the fastest way to damage the sending
 * domain's reputation and start landing every other email in spam.
 *
 * NOTE: uniqueness on `email` is added by emails/schema-patch.js in raw SQL,
 * not declared here — see the comment in EmailLog.js.
 */
const EmailSuppression = sequelize.define('EmailSuppression', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    // Always stored trimmed + lowercased.
    email: {
        type: Sequelize.STRING(255),
        allowNull: false,
    },
    reason: {
        type: Sequelize.ENUM('hard_bounce', 'complaint', 'manual', 'invalid'),
        allowNull: false,
        defaultValue: 'manual',
    },
    detail: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
    // Null for automatic suppressions (bounce processing).
    createdByAdminId: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
}, {
    tableName: 'EmailSuppressions',
    timestamps: true,
});

module.exports = EmailSuppression;
