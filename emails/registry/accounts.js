'use strict';

const { defineEvent } = require('./schema');

/**
 * Account lifecycle and security.
 *
 * Most of this category is `transactional: true` — an admin cannot switch off
 * "here are your login credentials" or "your password was changed", because
 * suppressing those either breaks access to the product or hides a security
 * event from the person it happened to. The global kill switch still overrides
 * them; only the settings UI honours the flag.
 *
 * These are also the only `critical: true` events, meaning call sites should
 * await the dispatch: it is two indexed inserts, and you want the intent
 * durably recorded before telling someone "check your email".
 *
 * Anchor sites: controllers/student.js, parent.js, teacher.js, admin.js, auth.js
 */

const sampleUser = {
    id: 7,
    firstName: 'Ayesha',
    lastName: 'Khan',
    username: 'ayesha.khan',
    email: 'ayesha@example.com',
};

module.exports = [
    defineEvent({
        key: 'account.created_student',
        category: 'accounts',
        label: 'Student account created',
        description: 'Welcome email with login details when a student account is created.',
        transactional: true,
        critical: true,
        defaultEnabled: true,
        audiences: ['student'],
        template: 'accounts/createdStudent',
        entityType: 'student',
        dedupScope: 'entity',
        priority: 1,
        samplePayload: { user: sampleUser, tempPassword: 'Xk4p-92fD' },
    }),

    defineEvent({
        key: 'account.created_parent',
        category: 'accounts',
        label: 'Parent account created',
        description: 'Welcome email with login details when a parent account is created.',
        transactional: true,
        critical: true,
        defaultEnabled: true,
        audiences: ['parent'],
        template: 'accounts/createdParent',
        entityType: 'parent',
        dedupScope: 'entity',
        priority: 1,
        samplePayload: { user: { ...sampleUser, firstName: 'Sana' }, tempPassword: 'Xk4p-92fD' },
    }),

    defineEvent({
        key: 'account.created_teacher',
        category: 'accounts',
        label: 'Teacher account created',
        description: 'Welcome email with login details when a teacher account is created.',
        transactional: true,
        critical: true,
        defaultEnabled: true,
        audiences: ['teacher'],
        template: 'accounts/createdTeacher',
        entityType: 'teacher',
        dedupScope: 'entity',
        priority: 1,
        samplePayload: { user: { ...sampleUser, firstName: 'Bilal' }, tempPassword: 'Xk4p-92fD' },
    }),

    defineEvent({
        key: 'account.created_admin',
        category: 'accounts',
        label: 'Admin account created',
        description: 'Welcome email with login details when an admin user is created.',
        transactional: true,
        critical: true,
        defaultEnabled: true,
        audiences: ['admin'],
        template: 'accounts/createdAdmin',
        entityType: 'admin',
        dedupScope: 'entity',
        priority: 1,
        samplePayload: { user: { ...sampleUser, firstName: 'Omar' }, roleName: 'Finance Manager' },
    }),

    defineEvent({
        key: 'account.password_changed',
        category: 'accounts',
        label: 'Password changed',
        description: 'Security notice sent whenever an account password is changed or reset by an admin.',
        transactional: true,
        critical: true,
        defaultEnabled: true,
        audiences: ['student', 'parent', 'teacher', 'admin'],
        template: 'accounts/passwordChanged',
        entityType: 'user',
        // 'always': a password can legitimately be changed repeatedly, and
        // suppressing the second notice would hide the very event that matters.
        dedupScope: 'always',
        priority: 1,
        samplePayload: { user: sampleUser, changedByAdmin: true },
    }),

    defineEvent({
        key: 'account.password_reset_requested',
        category: 'accounts',
        label: 'Password reset link',
        description: 'Sends the one-time reset link when someone requests a password reset.',
        transactional: true,
        critical: true,
        defaultEnabled: true,
        audiences: ['student', 'parent', 'teacher', 'admin'],
        template: 'accounts/passwordResetRequested',
        entityType: 'user',
        dedupScope: 'always',
        priority: 1,
        samplePayload: {
            user: sampleUser,
            resetUrl: 'https://lms.example.com/reset?token=abc123',
            expiresInMinutes: 60,
        },
    }),

    defineEvent({
        key: 'account.credentials_reissued',
        category: 'accounts',
        label: 'Login credentials re-sent',
        description: 'Re-sends username and a new temporary password when an admin reissues credentials.',
        transactional: true,
        critical: true,
        defaultEnabled: true,
        audiences: ['student', 'parent', 'teacher', 'admin'],
        template: 'accounts/credentialsReissued',
        entityType: 'user',
        dedupScope: 'always',
        priority: 1,
        samplePayload: { user: sampleUser, tempPassword: 'Xk4p-92fD' },
    }),

    defineEvent({
        key: 'account.email_changed',
        category: 'accounts',
        label: 'Email address changed',
        description: 'Security notice sent to both the old and new address when an email is changed.',
        transactional: true,
        critical: true,
        defaultEnabled: true,
        audiences: ['student', 'parent', 'teacher', 'admin'],
        template: 'accounts/emailChanged',
        entityType: 'user',
        dedupScope: 'always',
        priority: 1,
        samplePayload: {
            user: sampleUser,
            oldEmail: 'old@example.com',
            newEmail: 'ayesha@example.com',
        },
    }),

    defineEvent({
        key: 'account.deactivated',
        category: 'accounts',
        label: 'Account deactivated',
        description: 'Tells a user their account has been made inactive and they can no longer sign in.',
        defaultEnabled: true,
        audiences: ['student', 'parent', 'teacher'],
        template: 'accounts/deactivated',
        entityType: 'user',
        dedupScope: 'entity+day',
        priority: 1,
        samplePayload: { user: sampleUser },
    }),

    defineEvent({
        key: 'account.reactivated',
        category: 'accounts',
        label: 'Account reactivated',
        description: 'Tells a user their account has been restored and they can sign in again.',
        defaultEnabled: true,
        audiences: ['student', 'parent', 'teacher'],
        template: 'accounts/reactivated',
        entityType: 'user',
        dedupScope: 'entity+day',
        priority: 1,
        samplePayload: { user: sampleUser },
    }),

    defineEvent({
        key: 'account.bulk_import_finished',
        category: 'accounts',
        label: 'Bulk student import finished',
        description: 'Summary of a bulk student import sent to the admin who ran it.',
        defaultEnabled: true,
        audiences: ['admin'],
        template: 'accounts/bulkImportFinished',
        entityType: 'import',
        dedupScope: 'always',
        priority: 3,
        samplePayload: { created: 48, skipped: 2, failed: 1, errors: ['Row 14: duplicate username'] },
    }),

    defineEvent({
        key: 'security.role_permissions_changed',
        category: 'accounts',
        label: 'Role permissions changed',
        description: 'Alerts super admins when the permission set of a role is modified.',
        defaultEnabled: true,
        audiences: ['admin'],
        template: 'accounts/rolePermissionsChanged',
        entityType: 'role',
        dedupScope: 'always',
        priority: 1,
        samplePayload: { roleName: 'Finance Manager', permissionCount: 12, changedBy: 'Omar' },
    }),
];
