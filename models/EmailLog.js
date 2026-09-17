const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

/**
 * Permanent record of every email the system intended to send.
 *
 * This table — not EmailJobs — owns the deduplication guarantee. Jobs are
 * deleted once they succeed, so dedup enforced there would expire; the log row
 * survives forever and its UNIQUE dedupKey is what makes a second send of the
 * same (event, entity, recipient, bucket) impossible.
 *
 * NOTE: no `unique: true` and no `indexes: []` here on purpose. sync({alter:true})
 * re-adds indexes it cannot match, which accumulates dedupKey_2, dedupKey_3 ...
 * until the table hits MySQL's 64-key ceiling and every later boot fails. All
 * indexes for this table are created by emails/schema-patch.js in raw SQL.
 */
const EmailLog = sequelize.define('EmailLog', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    // sha1(eventKey|entityType|entityId|recipientEmail|bucket).slice(0,40)
    dedupKey: {
        type: Sequelize.STRING(64),
        allowNull: false,
    },
    eventKey: {
        type: Sequelize.STRING(80),
        allowNull: false,
    },
    category: {
        type: Sequelize.STRING(32),
        allowNull: false,
    },
    entityType: {
        type: Sequelize.STRING(32),
        allowNull: true,
    },
    entityId: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
    recipientEmail: {
        type: Sequelize.STRING(255),
        allowNull: false,
    },
    recipientName: {
        type: Sequelize.STRING(150),
        allowNull: true,
    },
    // Canonical lowercase: 'student' | 'parent' | 'teacher' | 'admin'
    recipientRole: {
        type: Sequelize.STRING(16),
        allowNull: false,
    },
    // NULL for addresses sourced from ADMIN_ALERT_EMAILS rather than a user row.
    // Deliberately NOT a foreign key — it points at four different tables
    // depending on recipientRole.
    recipientUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
    // Filled at render time, in the worker
    subject: {
        type: Sequelize.STRING(255),
        allowNull: true,
    },
    templateName: {
        type: Sequelize.STRING(80),
        allowNull: false,
    },
    status: {
        type: Sequelize.ENUM(
            'queued',
            'sending',
            'sent',
            'failed',
            'dead',
            'skipped_no_address',
            'suppressed',
            'dry_run',
            'cancelled'
        ),
        allowNull: false,
        defaultValue: 'queued',
    },
    attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    lastError: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
    // 'ECONNECTION' | 'EAUTH' | 'SMTP-550' ...
    lastErrorCode: {
        type: Sequelize.STRING(32),
        allowNull: true,
    },
    providerMessageId: {
        type: Sequelize.STRING(255),
        allowNull: true,
    },
    mode: {
        type: Sequelize.ENUM('live', 'sandbox', 'log', 'test'),
        allowNull: false,
        defaultValue: 'live',
    },
    // Template data. Enables re-render (admin preview) and resend.
    // Nulled after 90 days by the prune cron; the row itself is kept so the
    // dedup key survives forever.
    payload: {
        type: Sequelize.JSON,
        allowNull: true,
    },
    queuedAt: {
        type: Sequelize.DATE,
        allowNull: true,
    },
    sentAt: {
        type: Sequelize.DATE,
        allowNull: true,
    },
    failedAt: {
        type: Sequelize.DATE,
        allowNull: true,
    },
    openedAt: {
        type: Sequelize.DATE,
        allowNull: true,
    },
    bouncedAt: {
        type: Sequelize.DATE,
        allowNull: true,
    },
    bounceType: {
        type: Sequelize.ENUM('hard', 'soft', 'complaint'),
        allowNull: true,
    },
    // Set when an admin manually resends; points at the original log row.
    parentLogId: {
        type: Sequelize.INTEGER,
        allowNull: true,
    },
}, {
    tableName: 'EmailLogs',
    timestamps: true,
});

module.exports = EmailLog;
