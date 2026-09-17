'use strict';

/**
 * Worker-side job handler: load -> render -> throttle -> send -> record.
 *
 * Connection discipline matters here. The processor must NOT hold a database
 * connection while awaiting SMTP: read the log row and settings, let the
 * connection go, do the network call, then reacquire to write the outcome.
 * Holding a connection across a 30-second SMTP timeout on a pool of ten is how
 * the API starves.
 */

const { Op } = require('sequelize');
const EmailLog = require('../models/EmailLog');
const EmailSuppression = require('../models/EmailSuppression');
const registry = require('./registry');
const settings = require('./settings/cache');
const queue = require('./queue');
const throttle = require('./throttle');
const templates = require('./templates');
const transport = require('./transport');
const { classify } = require('./queue/backoff');
const alerts = require('./alerts');

/**
 * Global hourly circuit breaker.
 *
 * If something goes badly wrong — a bad loop, a resolver returning the whole
 * student table — this stops it. The queue is durable, so nothing is lost; it
 * just stops until a human looks.
 *
 * @returns {Promise<boolean>} true when sending may proceed
 */
async function circuitBreakerOk() {
    const limit = Number(settings.get('global.maxSendsPerHour', 500));
    if (!limit) return true;

    const sentLastHour = await EmailLog.count({
        where: {
            status: 'sent',
            sentAt: { [Op.gte]: new Date(Date.now() - 60 * 60_000) },
        },
    });

    if (sentLastHour < limit) return true;

    const store = require('./settings/store');
    await store.saveGlobals({ 'global.mode': 'off' }, null);
    await settings.refreshNow();
    await alerts.raise('circuit_breaker_tripped', { count: sentLastHour, limit, cooldownMinutes: 360 });
    return false;
}

/**
 * Handle one claimed job.
 * @param {Object} job EmailJobs row (plain object)
 */
async function handle(job) {
    const log = await EmailLog.findByPk(job.emailLogId);
    if (!log) {
        // Log row gone (pruned, or deleted by hand) — nothing to send.
        await queue.complete(job);
        return;
    }

    // Terminal already: a retry landed after a concurrent success.
    if (['sent', 'cancelled', 'suppressed', 'skipped_no_address'].includes(log.status)) {
        await queue.complete(job);
        return;
    }

    const snap = settings.current();
    const g = snap.globals;
    const mode = log.mode || g['global.mode'] || 'log';

    if (!g['global.enabled'] || mode === 'off') {
        await log.update({ status: 'cancelled', lastError: 'Sending disabled before this job ran.' });
        await queue.complete(job);
        return;
    }

    if (mode === 'live' && !(await circuitBreakerOk())) {
        // Leave it pending — the breaker paused sending, it did not fail this job.
        await queue.fail(job, new Error('Hourly send limit reached; sending paused.'), true);
        return;
    }

    const evt = registry.getEvent(log.eventKey);
    if (!evt) {
        await log.update({ status: 'cancelled', lastError: `Event "${log.eventKey}" no longer exists.` });
        await queue.complete(job);
        return;
    }

    let message;
    try {
        await log.update({ status: 'sending', attempts: job.attempts });

        const rendered = templates.render({
            templateName: log.templateName,
            category: log.category,
            data: log.payload || {},
            globals: g,
            recipient: { timeZone: null, name: log.recipientName, role: log.recipientRole },
        });

        const fromName = g['sender.fromName'];
        const fromEmail = g['sender.fromEmail'];
        const replyTo = g['sender.replyTo'];

        message = {
            from: `"${String(fromName).replace(/"/g, '')}" <${fromEmail}>`,
            to: log.recipientEmail,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            ...(replyTo ? { replyTo } : {}),
            headers: {
                // Lets a recipient's client thread related messages, and gives
                // support something to grep for in relay logs.
                'X-LMS-Event': log.eventKey,
                'X-LMS-Log-Id': String(log.id),
                // Transactional mail should never trigger an auto-responder.
                'Auto-Submitted': 'auto-generated',
            },
        };

        if (mode === 'sandbox') {
            message = transport.applySandbox(message, g['global.sandboxRedirectTo']);
        }

        await log.update({ subject: rendered.subject });
    } catch (err) {
        // A render failure is permanent — the same payload will fail identically
        // next time, so retrying just burns attempts.
        await log.update({
            status: 'dead',
            failedAt: new Date(),
            lastError: `Render failed: ${err.message}`.slice(0, 2000),
            lastErrorCode: 'ERENDER',
        });
        await queue.fail(job, err, false);
        console.error(`[emailWorker] render failed for log ${log.id} (${log.eventKey}):`, err.message);
        return;
    }

    // Backpressure, applied outside any open transaction.
    throttle.configure(g['global.throttlePerMinute']);
    await throttle.take();

    const startedAt = Date.now();
    try {
        const result = await transport.forMode(mode).send(message);

        await log.update({
            status: mode === 'log' ? 'dry_run' : 'sent',
            sentAt: new Date(),
            providerMessageId: result.messageId || null,
            lastError: null,
            lastErrorCode: null,
        });
        await queue.complete(job);

        console.log(
            `[emailWorker] sent id=${log.id} event=${log.eventKey} ` +
            `to=${transport.maskEmail(log.recipientEmail)} attempts=${job.attempts} ms=${Date.now() - startedAt}`
        );
    } catch (err) {
        const { retryable, code, permanentReason } = classify(err);

        await log.update({
            status: retryable ? 'failed' : 'dead',
            failedAt: new Date(),
            lastError: String(err.message || err).slice(0, 2000),
            lastErrorCode: code,
        });
        await queue.fail(job, err, retryable);

        // A hard bounce means the address is gone. Continuing to mail it is how
        // a sending domain's reputation gets destroyed.
        if (permanentReason === 'hard_bounce') {
            await EmailSuppression.findOrCreate({
                where: { email: String(log.recipientEmail).trim().toLowerCase() },
                defaults: {
                    email: String(log.recipientEmail).trim().toLowerCase(),
                    reason: 'hard_bounce',
                    detail: String(err.message || '').slice(0, 500),
                },
            }).catch(() => {});
            await log.update({ bouncedAt: new Date(), bounceType: 'hard' }).catch(() => {});
        }

        if (code === 'EAUTH' || code === 'ECONNECTION') {
            await alerts.raise('transport_down', { error: err.message });
        }

        console.error(
            `[emailWorker] send failed id=${log.id} event=${log.eventKey} ` +
            `to=${transport.maskEmail(log.recipientEmail)} code=${code} retryable=${retryable}: ${err.message}`
        );
    }
}

module.exports = { handle };
