const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

/**
 * Work queue row for the MySQL queue driver (used whenever REDIS_URL is unset).
 *
 * Rows are DELETED on success — EmailLogs is the permanent record. Rows that
 * exhaust maxAttempts stay behind with status='dead' as the dead-letter queue.
 *
 * Concurrency safety comes from the claim-token protocol in
 * emails/queue/mysqlDriver.js: an UPDATE ... WHERE status='pending' stamps a
 * token and a lease, then a SELECT reads back only that token's rows. Two
 * workers therefore claim provably disjoint sets without holding a transaction
 * across SMTP network I/O.
 *
 * NOTE: no index/unique declarations here — see the comment in EmailLog.js.
 */
const EmailJob = sequelize.define('EmailJob', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    emailLogId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    // Mirrors EmailLog.dedupKey so enqueue can be rejected without a join.
    dedupKey: {
        type: Sequelize.STRING(64),
        allowNull: false,
    },
    // 1 security/credentials · 2 money · 3 normal · 4 digest
    priority: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 3,
    },
    status: {
        type: Sequelize.ENUM('pending', 'processing', 'dead'),
        allowNull: false,
        defaultValue: 'pending',
    },
    // Absolute time the job becomes eligible. The poller's WHERE runAt <= NOW()
    // is the entire delayed-job mechanism for this driver.
    runAt: {
        type: Sequelize.DATE,
        allowNull: false,
    },
    // Incremented AT CLAIM TIME, not on failure: a worker SIGKILLed mid-send
    // must still burn the attempt, because we cannot know whether the SMTP DATA
    // command completed. At-most-once is the correct bias for email.
    attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    maxAttempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5,
    },
    claimToken: {
        type: Sequelize.CHAR(36),
        allowNull: true,
    },
    // `${hostname}:${pid}` — for debugging which worker holds a stuck lease
    lockedBy: {
        type: Sequelize.STRING(64),
        allowNull: true,
    },
    lockedAt: {
        type: Sequelize.DATE,
        allowNull: true,
    },
    leaseExpiresAt: {
        type: Sequelize.DATE,
        allowNull: true,
    },
    lastError: {
        type: Sequelize.TEXT,
        allowNull: true,
    },
}, {
    tableName: 'EmailJobs',
    timestamps: true,
});

module.exports = EmailJob;
