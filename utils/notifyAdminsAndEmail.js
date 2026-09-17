'use strict';

/**
 * Admin fan-out: in-app notification to every admin, plus the matching
 * admin-audience email event.
 *
 * The email leg resolves its own recipients from Admin.email plus the
 * configured ADMIN_ALERT_EMAILS fallback, so it does not reuse the notify
 * fan-out -- an admin with no email address still gets the in-app notification,
 * and an alert address with no Admin row still gets the email.
 */

const notifyAdmins = require('./notifyAdmins');
const { sendEmailEvent } = require('../emails');

/**
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} [opts.priority]
 * @param {boolean} [opts.superAdminOnly]
 * @param {string} [opts.emailEvent]
 * @param {Object} [opts.emailContext]
 * @param {Object} [opts.emailOptions]
 */
module.exports = async function notifyAdminsAndEmail({
    title,
    message,
    priority = 'info',
    superAdminOnly = false,
    emailEvent,
    emailContext = {},
    emailOptions = {},
}) {
    await Promise.allSettled([
        notifyAdmins({ title, message, priority, superAdminOnly }),
        emailEvent ? sendEmailEvent(emailEvent, emailContext, emailOptions) : Promise.resolve(),
    ]);
};
