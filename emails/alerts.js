'use strict';

/**
 * Failure alerting for the email subsystem.
 *
 * Alerts go out as IN-APP notifications, never as email. Emailing about a
 * broken email system is either useless (the transport is down) or an infinite
 * loop (the failure alert fails, raising a failure alert).
 *
 * Cooldowns live in the EmailSettings table rather than an in-memory Set,
 * because the existing crons' in-memory dedup re-fires on every deploy restart
 * and PM2 restarts on every push.
 */

const { Op } = require('sequelize');
const EmailSetting = require('../models/EmailSetting');

const DEFAULT_COOLDOWN_MINUTES = Number(process.env.EMAIL_ALERT_COOLDOWN_MIN || 60);

const MESSAGES = {
    transport_down: (d) => ({
        title: 'Email delivery is failing',
        message: `The mail server could not be reached (${d.error}). Emails are queued and will retry, but nothing is going out.`,
        priority: 'critical',
    }),
    high_failure_rate: (d) => ({
        title: 'High email failure rate',
        message: `${d.failed} of the last ${d.total} emails failed. Check the delivery log.`,
        priority: 'critical',
    }),
    jobs_dead: (d) => ({
        title: 'Emails failed permanently',
        message: `${d.count} email${d.count === 1 ? '' : 's'} could not be delivered after all retries. Review the delivery log.`,
        priority: 'warning',
    }),
    queue_stalled: (d) => ({
        title: 'Email queue is not draining',
        message: `The oldest queued email has been waiting ${d.minutes} minutes. The worker may be down.`,
        priority: 'warning',
    }),
    dispatch_cap_exceeded: (d) => ({
        title: 'Email batch aborted',
        message: `"${d.eventKey}" resolved ${d.count} recipients, over the ${d.cap} limit. Nothing was sent — check the event's audience.`,
        priority: 'critical',
    }),
    circuit_breaker_tripped: (d) => ({
        title: 'Email sending stopped automatically',
        message: `${d.count} emails were sent in the last hour, over the ${d.limit} limit. Sending is paused until an admin re-enables it.`,
        priority: 'critical',
    }),
};

const cooldownKey = (kind) => `alert.cooldown.${kind}`;

/**
 * @param {string} kind
 * @param {number} minutes
 * @returns {Promise<boolean>} true when the alert may fire
 */
async function claimCooldown(kind, minutes) {
    const key = cooldownKey(kind);
    const now = Date.now();

    const row = await EmailSetting.findByPk(key);
    if (row && row.value && row.value.v) {
        const last = new Date(row.value.v).getTime();
        if (Number.isFinite(last) && now - last < minutes * 60_000) return false;
    }

    await EmailSetting.upsert({ settingKey: key, value: { v: new Date(now).toISOString() } });
    return true;
}

/**
 * Raise an alert, respecting its cooldown.
 * Never throws — alerting must not be able to break the thing it is reporting on.
 *
 * @param {keyof MESSAGES} kind
 * @param {Object} [data]
 */
async function raise(kind, data = {}) {
    try {
        const build = MESSAGES[kind];
        if (!build) return false;

        const minutes = Number(data.cooldownMinutes || DEFAULT_COOLDOWN_MINUTES);
        if (!(await claimCooldown(kind, minutes))) return false;

        const { title, message, priority } = build(data);

        // Lazy require: notifyAdmins pulls in models and the socket layer, and
        // this module is reachable from dispatch. The codebase already uses
        // lazy requires for exactly this reason (see middleware/rateLimiter.js).
        const notifyAdmins = require('../utils/notifyAdmins');
        await notifyAdmins({ title, message, priority });

        console.warn(`[emailAlerts] ${kind}: ${message}`);
        return true;
    } catch (err) {
        console.error('[emailAlerts] failed to raise alert:', err.message);
        return false;
    }
}

/**
 * Evaluate the conditions the sweeper checks each minute.
 * @param {Object} deps
 */
async function evaluate({ stats }) {
    try {
        const EmailLog = require('../models/EmailLog');

        // Worker down or wedged: oldest pending job is far past due.
        if (stats && stats.oldestPendingAt) {
            const waitedMin = Math.floor((Date.now() - new Date(stats.oldestPendingAt).getTime()) / 60_000);
            if (waitedMin >= 30) await raise('queue_stalled', { minutes: waitedMin });
        }

        // Failure rate across the recent window.
        const recent = await EmailLog.findAll({
            where: { status: { [Op.in]: ['sent', 'failed', 'dead'] } },
            attributes: ['status'],
            order: [['id', 'DESC']],
            limit: 50,
        });
        if (recent.length >= 20) {
            const failed = recent.filter((r) => r.status !== 'sent').length;
            if (failed / recent.length > 0.2) {
                await raise('high_failure_rate', { failed, total: recent.length });
            }
        }

        // Anything newly buried.
        const deadCount = await EmailLog.count({
            where: {
                status: 'dead',
                updatedAt: { [Op.gte]: new Date(Date.now() - 60 * 60_000) },
            },
        });
        if (deadCount > 0) await raise('jobs_dead', { count: deadCount });
    } catch (err) {
        console.error('[emailAlerts] evaluate failed:', err.message);
    }
}

module.exports = { raise, evaluate, MESSAGES };
