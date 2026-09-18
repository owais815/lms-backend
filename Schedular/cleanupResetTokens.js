'use strict';

/**
 * Prunes spent and expired password reset tokens.
 *
 * They are dead weight once used or expired, and each row holds an email
 * address and a requesting IP -- keeping them indefinitely is data retention
 * with no purpose. A short grace period is kept so a support question like
 * "did a reset link ever go out for this account?" is still answerable.
 */

const cron = require('node-cron');
const { Op } = require('sequelize');
const PasswordResetToken = require('../models/PasswordResetToken');

const RETAIN_DAYS = Number(process.env.PASSWORD_RESET_RETAIN_DAYS || 7);

function startResetTokenCleanup() {
    // 02:30 daily -- after the other nightly jobs have finished.
    cron.schedule('30 2 * * *', async () => {
        try {
            const cutoff = new Date(Date.now() - RETAIN_DAYS * 86_400_000);
            const removed = await PasswordResetToken.destroy({
                where: {
                    [Op.or]: [
                        { usedAt: { [Op.lt]: cutoff } },
                        { expiresAt: { [Op.lt]: cutoff } },
                    ],
                },
            });
            if (removed > 0) {
                console.log(`[resetTokens] pruned ${removed} spent/expired token(s).`);
            }
        } catch (err) {
            console.error('[resetTokens] cleanup failed:', err.message);
        }
    });

    console.log(`[resetTokens] cleanup cron started (daily 02:30, retains ${RETAIN_DAYS} days).`);
}

module.exports = { startResetTokenCleanup };
