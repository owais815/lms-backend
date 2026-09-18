'use strict';

/**
 * Raw-SQL schema patches for the email subsystem.
 *
 * Why this file exists instead of declaring indexes on the models: this repo
 * runs sequelize.sync({ alter: true }) on every boot, and alter-sync re-adds
 * indexes it cannot match against what already exists. models/ClassSession.js
 * carries the scar tissue in a comment -- "unique constraint removed from model
 * to avoid MySQL 64-key limit on alter sync". A UNIQUE dedupKey declared on the
 * model would accumulate dedupKey_2, dedupKey_3 ... on every restart until the
 * table hits MySQL's 64-key ceiling, at which point EVERY subsequent boot fails
 * and takes the API down with it.
 *
 * The never-double-send guarantee must not rest on a mechanism that degrades on
 * restart, so every index lives here, applied idempotently -- the same shape as
 * the existing patchEnumColumns() in app.js.
 */

const sequelize = require('../utils/database');

// Errors that mean "already applied" rather than "broken".
const ALREADY_APPLIED = /duplicate key name|duplicate column|already exists|duplicate entry/i;

const STATEMENTS = [
    // Admin recipients. Nullable because existing rows have no address, and
    // NOT NULL would fail the ALTER. This also repairs a live bug: the signup
    // validator at routes/admin.js:19 already queries Admin.email, which
    // currently throws "Unknown column 'Admin.email'".
    "ALTER TABLE `Admins` ADD COLUMN `email` VARCHAR(255) NULL",

    // THE index. Everything in the dedup design rests on this one constraint.
    "CREATE UNIQUE INDEX `uq_emaillog_dedup` ON `EmailLogs` (`dedupKey`)",
    "CREATE INDEX `idx_emaillog_event`  ON `EmailLogs` (`eventKey`, `createdAt`)",
    "CREATE INDEX `idx_emaillog_status` ON `EmailLogs` (`status`, `createdAt`)",
    "CREATE INDEX `idx_emaillog_recip`  ON `EmailLogs` (`recipientEmail`, `createdAt`)",
    "CREATE INDEX `idx_emaillog_entity` ON `EmailLogs` (`entityType`, `entityId`)",

    // Enqueue-side dedup for the MySQL driver.
    "CREATE UNIQUE INDEX `uq_emailjob_dedup` ON `EmailJobs` (`dedupKey`)",
    // Drives the claim UPDATE's WHERE + ORDER BY.
    "CREATE INDEX `idx_emailjob_claim` ON `EmailJobs` (`status`, `runAt`, `priority`)",
    "CREATE INDEX `idx_emailjob_token` ON `EmailJobs` (`claimToken`)",
    "CREATE INDEX `idx_emailjob_lease` ON `EmailJobs` (`leaseExpiresAt`)",

    "CREATE UNIQUE INDEX `uq_suppression_email` ON `EmailSuppressions` (`email`)",

    // Password reset tokens. The lookup is always by hash, and expired rows are
    // pruned by date.
    "CREATE UNIQUE INDEX `uq_reset_token` ON `PasswordResetTokens` (`tokenHash`)",
    "CREATE INDEX `idx_reset_user` ON `PasswordResetTokens` (`userType`, `userId`, `usedAt`)",
    "CREATE INDEX `idx_reset_expiry` ON `PasswordResetTokens` (`expiresAt`)",
];

/**
 * Apply every patch, tolerating the ones already in place.
 * Safe to call on every boot.
 */
async function patchEmailSchema() {
    let applied = 0;
    for (const sql of STATEMENTS) {
        try {
            await sequelize.query(sql);
            applied += 1;
        } catch (err) {
            // Only swallow "already there" -- a genuine failure must be loud,
            // because a missing index here is a silent correctness hole.
            if (!ALREADY_APPLIED.test(err.message || '')) {
                console.error('[emailSchema] patch failed:', sql, '->', err.message);
            }
        }
    }
    if (applied > 0) {
        console.log(`[emailSchema] applied ${applied} new schema patch(es).`);
    }
}

/**
 * Confirm the dedup index actually exists.
 *
 * The entire never-double-send guarantee is this one index. If it were silently
 * absent -- dropped by hand, or lost to a failed ALTER -- the system would keep
 * running and quietly send duplicates, which is worse than not running at all.
 * The worker calls this at boot and refuses to start when it returns false.
 *
 * @returns {Promise<boolean>}
 */
async function verifyDedupIndex() {
    const [rows] = await sequelize.query(
        `SELECT COUNT(*) AS n
           FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME   = 'EmailLogs'
            AND INDEX_NAME   = 'uq_emaillog_dedup'
            AND NON_UNIQUE   = 0`
    );
    return Number(rows?.[0]?.n || 0) > 0;
}

module.exports = { patchEmailSchema, verifyDedupIndex };
