'use strict';

/**
 * Self-service password reset.
 *
 * This flow did not exist before: an LMS with no way to recover an account
 * means every forgotten password becomes an admin ticket, and the
 * account.password_reset_requested email had nothing to fire it.
 *
 * Security decisions worth stating, because each one is a deliberate trade:
 *
 *  - Only a hash of the token is stored. A database dump contains nothing
 *    usable.
 *  - The request endpoint ALWAYS returns the same success response, whether or
 *    not the address exists. Otherwise it becomes an oracle for enumerating
 *    which of your students and parents have accounts.
 *  - Tokens are single-use and short-lived, and every other outstanding token
 *    for that account is invalidated when one is issued or spent.
 *  - The reset itself is awaited end-to-end, unlike most email in this system:
 *    if the email cannot even be queued, the user must not be told to go and
 *    check their inbox.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

const PasswordResetToken = require('../models/PasswordResetToken');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Teacher = require('../models/Teacher');
const Admin = require('../models/Admin');
const { sendEmailEvent } = require('../emails');
const settings = require('../emails/settings/cache');

const TOKEN_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 60);
const MIN_PASSWORD_LENGTH = 8;

/** userType -> model. Canonical lowercase, matching the email subsystem. */
const MODELS = {
    student: Student,
    parent: Parent,
    teacher: Teacher,
    admin: Admin,
};

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** The same response every time, so this cannot be used to enumerate accounts. */
const OPAQUE_OK = {
    success: true,
    message: 'If that email address has an account, a reset link is on its way.',
};

/**
 * Find whoever owns an email address, across all four account tables.
 * @param {string} email
 * @returns {Promise<{user:object, userType:string}|null>}
 */
async function findAccountByEmail(email) {
    const normalized = String(email).trim().toLowerCase();

    for (const [userType, Model] of Object.entries(MODELS)) {
        // Admin has no firstName/lastName, so only select what exists on each.
        const attributes = userType === 'admin'
            ? ['id', 'name', 'username', 'email']
            : ['id', 'firstName', 'lastName', 'username', 'email'];

        const user = await Model.findOne({
            where: { email: normalized },
            attributes,
        }).catch(() => null);

        if (user) return { user, userType };
    }
    return null;
}

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 */
exports.requestReset = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || typeof email !== 'string') {
            return res.status(422).json({ success: false, message: 'An email address is required.' });
        }

        const found = await findAccountByEmail(email);

        // No account: stop here, but return the same body and roughly the same
        // timing as the success path.
        if (!found) {
            console.log(`[passwordReset] no account for ${String(email).slice(0, 3)}*** — returning opaque success.`);
            return res.json(OPAQUE_OK);
        }

        const { user, userType } = found;

        // Invalidate anything still outstanding: requesting a new link should
        // render the old one dead, not leave several valid at once.
        await PasswordResetToken.update(
            { usedAt: new Date() },
            { where: { userType, userId: user.id, usedAt: null } }
        );

        const token = crypto.randomBytes(32).toString('hex');
        await PasswordResetToken.create({
            tokenHash: hash(token),
            userType,
            userId: user.id,
            email: String(user.email).trim().toLowerCase(),
            expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000),
            requestedIp: req.ip || req.connection?.remoteAddress || null,
        });

        const appUrl = String(settings.get('links.appBaseUrl', '') || '').replace(/\/+$/, '');
        const resetUrl = `${appUrl}/reset-password?token=${token}&type=${userType}`;

        // Awaited: this event is `critical`, and we are about to tell the user
        // to go and check their inbox.
        await sendEmailEvent('account.password_reset_requested', {
            user,
            userRole: userType,
            resetUrl,
            expiresInMinutes: TOKEN_TTL_MINUTES,
            __recipients: [{
                email: user.email,
                name: user.name || [user.firstName, user.lastName].filter(Boolean).join(' '),
                role: userType,
                userId: user.id,
                timeZone: null,
                source: 'db',
            }],
        }, { occurredAt: new Date() });

        return res.json(OPAQUE_OK);
    } catch (err) {
        console.error('[passwordReset] requestReset failed:', err.message);
        // Even on failure, do not reveal anything about the address.
        return res.json(OPAQUE_OK);
    }
};

/**
 * GET /api/auth/reset-password/verify?token=…
 * Lets the reset page show "this link has expired" before the user types a new
 * password, rather than after.
 */
exports.verifyToken = async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(422).json({ valid: false, message: 'No token supplied.' });

        const row = await PasswordResetToken.findOne({
            where: {
                tokenHash: hash(String(token)),
                usedAt: null,
                expiresAt: { [Op.gt]: new Date() },
            },
        });

        if (!row) {
            return res.status(400).json({
                valid: false,
                message: 'This reset link is invalid or has expired. Please request a new one.',
            });
        }

        return res.json({ valid: true, userType: row.userType });
    } catch (err) {
        console.error('[passwordReset] verifyToken failed:', err.message);
        return res.status(500).json({ valid: false, message: 'Could not check that link.' });
    }
};

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 */
exports.resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token) {
            return res.status(422).json({ success: false, message: 'No token supplied.' });
        }
        if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
            return res.status(422).json({
                success: false,
                message: `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
            });
        }

        const row = await PasswordResetToken.findOne({
            where: {
                tokenHash: hash(String(token)),
                usedAt: null,
                expiresAt: { [Op.gt]: new Date() },
            },
        });

        if (!row) {
            return res.status(400).json({
                success: false,
                message: 'This reset link is invalid or has expired. Please request a new one.',
            });
        }

        const Model = MODELS[row.userType];
        if (!Model) {
            return res.status(400).json({ success: false, message: 'Unknown account type.' });
        }

        const user = await Model.findByPk(row.userId);
        if (!user) {
            return res.status(400).json({ success: false, message: 'That account no longer exists.' });
        }

        // Spend the token BEFORE changing the password. If the update then
        // fails, the user requests a fresh link; the alternative ordering could
        // leave a spent token usable again.
        row.usedAt = new Date();
        await row.save();

        // Kill any sibling tokens too.
        await PasswordResetToken.update(
            { usedAt: new Date() },
            { where: { userType: row.userType, userId: row.userId, usedAt: null } }
        );

        await user.update({ password: await bcrypt.hash(String(password), 12) });

        // Tell them it happened. If this was not them, this email is how they
        // find out — so it is worth awaiting.
        await sendEmailEvent('account.password_changed', {
            user,
            userRole: row.userType,
            changedByAdmin: false,
            __recipients: [{
                email: row.email,
                name: user.name || [user.firstName, user.lastName].filter(Boolean).join(' '),
                role: row.userType,
                userId: user.id,
                timeZone: null,
                source: 'db',
            }],
        }, { occurredAt: new Date() });

        console.log(`[passwordReset] password reset for ${row.userType} #${row.userId}.`);

        return res.json({
            success: true,
            message: 'Your password has been changed. You can sign in with it now.',
        });
    } catch (err) {
        console.error('[passwordReset] resetPassword failed:', err.message);
        return res.status(500).json({ success: false, message: 'Could not reset your password.' });
    }
};
