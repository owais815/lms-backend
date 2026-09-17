'use strict';

/**
 * Account lifecycle and security templates.
 *
 * These are the emails people act on immediately, so they are short, lead with
 * the thing the reader needs, and avoid marketing tone.
 */

const { h } = require('./escape');
const { p, panel, infoRow, button, callout, muted } = require('./components');

/** Shared credential block — username plus a temporary password. */
const credentials = (user, tempPassword, ctx) => h`
${panel([
    infoRow('Username', user.username),
    ...(tempPassword ? [infoRow('Temporary password', tempPassword)] : []),
    ...(user.email ? [infoRow('Email', user.email)] : []),
])}
${tempPassword ? muted('Please sign in and change this password straight away. It is temporary and should not be shared.') : ''}
${button('Sign in', `${ctx.appUrl}/login`, ctx.primaryColor)}`;

const welcome = (roleLabel) => ({
    subject: (d) => `Your ${d.ctx.brand} account is ready`,
    preheader: () => 'Here are your sign-in details.',
    html: (d) => h`
${p(h`Hi ${d.ctx.name(d.user)},`)}
${p(h`A ${roleLabel} account has been created for you on ${d.ctx.brand}.`)}
${credentials(d.user, d.tempPassword, d.ctx)}
${muted('If you were not expecting this email, please let us know.')}`,
    text: (d) => [
        `Hi ${d.ctx.name(d.user)},`,
        '',
        `A ${roleLabel} account has been created for you on ${d.ctx.brand}.`,
        '',
        `Username: ${d.user.username}`,
        ...(d.tempPassword ? [`Temporary password: ${d.tempPassword}`] : []),
        '',
        `Sign in: ${d.ctx.appUrl}/login`,
        '',
        'Please change your password after signing in.',
    ].join('\n'),
});

module.exports = {
    createdStudent: welcome('student'),
    createdParent: welcome('parent'),
    createdTeacher: welcome('teacher'),
    createdAdmin: {
        subject: (d) => `Your ${d.ctx.brand} admin account is ready`,
        preheader: () => 'Here are your sign-in details.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.user)},`)}
${p(h`An administrator account has been created for you on ${d.ctx.brand}${d.roleName ? h` with the role <strong>${d.roleName}</strong>` : ''}.`)}
${credentials(d.user, d.tempPassword, d.ctx)}`,
    },

    passwordChanged: {
        subject: () => 'Your password was changed',
        preheader: () => 'If this was not you, contact us immediately.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.user)},`)}
${p(d.changedByAdmin
    ? h`An administrator has changed the password on your ${d.ctx.brand} account.`
    : h`The password on your ${d.ctx.brand} account was changed.`)}
${callout('If you did not expect this, contact us immediately — your account may be at risk.', 'warning')}
${button('Sign in', `${d.ctx.appUrl}/login`, d.ctx.primaryColor)}`,
        text: (d) => [
            `Hi ${d.ctx.name(d.user)},`,
            '',
            d.changedByAdmin
                ? `An administrator has changed the password on your ${d.ctx.brand} account.`
                : `The password on your ${d.ctx.brand} account was changed.`,
            '',
            'If you did not expect this, contact us immediately.',
            '',
            `Sign in: ${d.ctx.appUrl}/login`,
        ].join('\n'),
    },

    passwordResetRequested: {
        subject: () => 'Reset your password',
        preheader: (d) => `This link expires in ${d.expiresInMinutes || 60} minutes.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.user)},`)}
${p('We received a request to reset your password. Use the button below to choose a new one.')}
${button('Reset password', d.resetUrl, d.ctx.primaryColor)}
${muted(h`This link expires in ${d.expiresInMinutes || 60} minutes and can only be used once.`)}
${muted('If you did not request a password reset, you can safely ignore this email — your password will not change.')}`,
        text: (d) => [
            `Hi ${d.ctx.name(d.user)},`,
            '',
            'We received a request to reset your password. Open this link to choose a new one:',
            '',
            d.resetUrl,
            '',
            `This link expires in ${d.expiresInMinutes || 60} minutes and can only be used once.`,
            'If you did not request a reset, you can ignore this email.',
        ].join('\n'),
    },

    credentialsReissued: {
        subject: (d) => `Your ${d.ctx.brand} sign-in details`,
        preheader: () => 'A new temporary password has been set for your account.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.user)},`)}
${p('Your sign-in details have been reissued.')}
${credentials(d.user, d.tempPassword, d.ctx)}`,
    },

    emailChanged: {
        subject: () => 'The email on your account was changed',
        preheader: () => 'If this was not you, contact us immediately.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.user)},`)}
${p('The email address on your account has been updated.')}
${panel([
    infoRow('Previous', d.oldEmail || '—'),
    infoRow('New', d.newEmail || '—'),
])}
${callout('If you did not make this change, contact us immediately.', 'warning')}`,
    },

    deactivated: {
        subject: (d) => `Your ${d.ctx.brand} account has been deactivated`,
        preheader: () => 'You will not be able to sign in until it is restored.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.user)},`)}
${p(h`Your ${d.ctx.brand} account has been deactivated and you will not be able to sign in.`)}
${muted('If you think this is a mistake, please get in touch and we will look into it.')}`,
    },

    reactivated: {
        subject: (d) => `Your ${d.ctx.brand} account is active again`,
        preheader: () => 'You can sign in as usual.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.user)},`)}
${callout('Your account has been restored — you can sign in as usual.', 'success')}
${button('Sign in', `${d.ctx.appUrl}/login`, d.ctx.primaryColor)}`,
    },

    bulkImportFinished: {
        subject: (d) => `Student import finished — ${d.created} created`,
        preheader: (d) => `${d.created} created, ${d.skipped} skipped, ${d.failed} failed.`,
        html: (d) => h`
${p('Your bulk student import has finished.')}
${panel([
    infoRow('Created', String(d.created)),
    infoRow('Skipped', String(d.skipped)),
    infoRow('Failed', String(d.failed)),
])}
${d.errors && d.errors.length
    ? h`${p('Issues found:')}${require('./components').list(d.errors.slice(0, 20))}`
    : ''}
${button('View students', `${d.ctx.appUrl}/students`, d.ctx.primaryColor)}`,
    },

    rolePermissionsChanged: {
        subject: (d) => `Permissions changed for role "${d.roleName}"`,
        preheader: (d) => `${d.permissionCount} permissions are now assigned.`,
        html: (d) => h`
${p(h`The permission set for the role <strong>${d.roleName}</strong> has been updated.`)}
${panel([
    infoRow('Role', d.roleName),
    infoRow('Permissions assigned', String(d.permissionCount)),
    ...(d.changedBy ? [infoRow('Changed by', d.changedBy)] : []),
])}
${callout('Review this change if you did not expect it — it affects what that role can see and do.', 'warning')}
${button('Review roles', `${d.ctx.appUrl}/roles-permissions`, d.ctx.primaryColor)}`,
    },
};
