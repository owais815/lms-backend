const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

/**
 * One-time password reset tokens.
 *
 * Only a SHA-256 hash of the token is stored, never the token itself — for the
 * same reason passwords are hashed. A database dump, a backup, or a stray log
 * line then contains nothing an attacker can use to take over an account.
 * The plaintext exists only in the email that was sent.
 *
 * NOTE: no index declarations here — see the comment in EmailLog.js. The index
 * on tokenHash is created by emails/schema-patch.js in raw SQL.
 */
const PasswordResetToken = sequelize.define('PasswordResetToken', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    // sha256 hex of the token handed to the user.
    tokenHash: {
        type: Sequelize.STRING(64),
        allowNull: false,
    },
    // Canonical lowercase: student | parent | teacher | admin
    userType: {
        type: Sequelize.STRING(16),
        allowNull: false,
    },
    // Deliberately not a foreign key — it points at one of four tables.
    userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    // Kept so a reset can be traced back to the address that requested it, even
    // if the account's email changes afterwards.
    email: {
        type: Sequelize.STRING(255),
        allowNull: false,
    },
    expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
    },
    // Set the moment the token is spent. A token with this set is dead, which
    // is what makes it single-use.
    usedAt: {
        type: Sequelize.DATE,
        allowNull: true,
    },
    requestedIp: {
        type: Sequelize.STRING(64),
        allowNull: true,
    },
}, {
    tableName: 'PasswordResetTokens',
    timestamps: true,
});

module.exports = PasswordResetToken;
