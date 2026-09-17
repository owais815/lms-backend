'use strict';

/**
 * In-app notification + the matching email event, in one call.
 *
 * Deliberately a PARALLEL helper rather than a change to notify() itself.
 * notify() has 100+ call sites; adding an email leg inside it would turn every
 * one of them into a mail-sender on the first deploy -- exactly the flood this
 * design exists to prevent. It also could not work mechanically: notify() takes
 * a free-text `message` with no event key and no entity, so any wrapper would
 * have to guess which registry event was meant, and guessing produces emails
 * whose body is a notification string.
 *
 * Migrating a call site is then a one-line, reviewable change.
 */

const notify = require('./notify');
const { sendEmailEvent } = require('../emails');

/**
 * @param {Object} opts
 * @param {number} opts.userId
 * @param {string} opts.userType         lowercase: student|parent|teacher|admin
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} [opts.priority]
 * @param {string} [opts.emailEvent]     registry key; omit for in-app only
 * @param {Object} [opts.emailContext]   entity bag for the template
 * @param {Object} [opts.emailOptions]   { transaction, dedupBucket, occurredAt, runAt }
 * @returns {Promise<Object|undefined>} the Notification record
 */
module.exports = async function notifyAndEmail({
    userId,
    userType,
    title,
    message,
    priority = 'info',
    emailEvent,
    emailContext = {},
    emailOptions = {},
}) {
    // allSettled, not all: an email failure must never stop the in-app
    // notification, and vice versa. Both legs are independent by design.
    const [notified] = await Promise.allSettled([
        notify({ userId, userType, title, message, priority }),
        emailEvent ? sendEmailEvent(emailEvent, emailContext, emailOptions) : Promise.resolve(),
    ]);

    return notified.status === 'fulfilled' ? notified.value : undefined;
};
