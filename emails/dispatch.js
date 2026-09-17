'use strict';

/**
 * The dispatch path: resolve -> gate -> dedup insert -> enqueue.
 *
 * This runs inside HTTP request handlers, so its overriding property is that it
 * CANNOT break the request. It never rejects, never renders, never touches the
 * network, and does two indexed inserts per recipient. Typical cost is a few
 * milliseconds.
 */

const registry = require('./registry');
const settings = require('./settings/cache');
const queue = require('./queue');
const { buildDedupKey } = require('./queue/dedup');
const { resolveRecipients, loadSuppressions } = require('./recipients');
const EmailLog = require('../models/EmailLog');

/** Entity id for the log row and the dedup key, from whatever was passed. */
function extractEntityId(evt, context) {
    const direct = context[evt.entityType];
    if (direct && direct.id) return direct.id;

    const byName = {
        fee: context.fee,
        payment: context.payment,
        salary: context.salary,
        session: context.session,
        assignment: context.assignment,
        quiz: context.quiz,
        certificate: context.certificate,
        makeup: context.makeup,
        leave: context.leave,
        expense: context.expense,
        schedule: context.schedule,
        support_request: context.request,
        plan_change: context.request,
        weekly_content: context.content,
        quiz_attempt: context.attempt,
        session_feedback: context.feedback,
        resource: context.resource,
        role: context.role,
        user: context.user,
        student: context.student,
        parent: context.parent,
        teacher: context.teacher,
        admin: context.user,
        attendance: context.attendance,
        course_detail: context.courseDetail,
    };
    const entity = byName[evt.entityType];
    if (entity && entity.id) return entity.id;
    if (context.entityId) return context.entityId;
    return null;
}

/** Strip Sequelize instances down to plain data the template can use. */
function toPlain(value) {
    if (!value || typeof value !== 'object') return value;
    if (typeof value.get === 'function') return value.get({ plain: true });
    if (Array.isArray(value)) return value.map(toPlain);
    return value;
}

function plainContext(context) {
    const out = {};
    for (const [k, v] of Object.entries(context)) {
        if (k.startsWith('__')) continue;
        out[k] = toPlain(v);
    }
    return out;
}

/**
 * Fire a registry email event.
 *
 * NEVER throws and NEVER rejects — a missing `await` therefore cannot produce
 * an unhandledRejection, which matters because app.js installs a handler that
 * only logs, and an uncaughtException handler that calls process.exit(1).
 *
 * @param {string} eventKey
 * @param {Object} [context]  entity bag, e.g. { fee, student }
 * @param {Object} [options]
 * @param {import('sequelize').Transaction} [options.transaction]
 * @param {string} [options.dedupBucket]  required for dedupScope 'period'
 * @param {Date}   [options.runAt]
 * @param {Date}   [options.occurredAt]   basis for the go-live backfill guard
 * @param {string} [options.mode]         override, used by the test-send endpoint
 * @returns {Promise<{queued:number, skipped:number, reason?:string}>}
 */
async function sendEmailEvent(eventKey, context = {}, options = {}) {
    try {
        const evt = registry.getEvent(eventKey);
        if (!evt) {
            // A typo degrades to a warning, not a 500.
            console.warn(`[email] unknown event "${eventKey}" — ignored.`);
            return { queued: 0, skipped: 0, reason: 'unknown_event' };
        }

        const snap = settings.current();
        const g = snap.globals;
        const mode = options.mode || g['global.mode'] || 'log';

        // --- gates ---------------------------------------------------------
        if (!g['global.enabled'] || mode === 'off') {
            return { queued: 0, skipped: 0, reason: 'globally_disabled' };
        }

        const eventSettings = snap.events[eventKey];
        // transactional events ignore the stored toggle (see settings/store.js)
        if (eventSettings && !eventSettings.enabled && !evt.transactional) {
            return { queued: 0, skipped: 0, reason: 'event_disabled' };
        }

        // The backfill guard. This is the layer that distinguishes "this fee
        // went overdue today" from "this fee went overdue in March", and it is
        // what stops the first live cron run mailing months of history.
        const goLiveAt = g['global.goLiveAt'];
        if (goLiveAt && options.occurredAt) {
            if (new Date(options.occurredAt).getTime() < new Date(goLiveAt).getTime()) {
                return { queued: 0, skipped: 0, reason: 'before_go_live' };
            }
        }

        // --- recipients ----------------------------------------------------
        const suppressed = await loadSuppressions();
        const resolved = await resolveRecipients(eventKey, context, {
            audiences: eventSettings ? eventSettings.audiences : evt.audiences,
            adminEmails: g['global.adminAlertEmails'] || [],
            suppressed,
        });

        const cap = Number(g['global.maxEnqueuePerDispatch'] || 200);
        if (resolved.recipients.length > cap) {
            // Abort, not truncate. A truncated batch is a silent partial send;
            // an aborted one is a visible incident someone can fix.
            console.error(
                `[email] "${eventKey}" resolved ${resolved.recipients.length} recipients, over the ${cap} cap — aborted.`
            );
            require('./alerts').raise('dispatch_cap_exceeded', {
                eventKey,
                count: resolved.recipients.length,
                cap,
            }).catch(() => {});
            return { queued: 0, skipped: resolved.recipients.length, reason: 'recipient_cap_exceeded' };
        }

        const entityId = extractEntityId(evt, context);
        const payload = plainContext(context);
        const timezone = g['global.timezone'];

        const baseRow = {
            eventKey: evt.key,
            category: evt.category,
            entityType: evt.entityType,
            entityId,
            templateName: evt.template,
            mode,
            payload,
            queuedAt: new Date(),
        };

        let queued = 0;

        // Recipients with no usable address: recorded so the admin UI can
        // surface them as a data-quality task rather than losing them.
        for (const s of resolved.skipped) {
            await EmailLog.create({
                ...baseRow,
                dedupKey: buildDedupKey({
                    eventKey: evt.key,
                    scope: 'always',
                    entityType: evt.entityType,
                    entityId,
                    recipientEmail: `missing:${s.role}:${s.userId || 'unknown'}`,
                    timezone,
                }),
                recipientEmail: '',
                recipientName: s.name || '',
                recipientRole: s.role,
                recipientUserId: s.userId || null,
                status: 'skipped_no_address',
            }, { transaction: options.transaction }).catch(() => {});
        }

        for (const s of resolved.suppressed) {
            await EmailLog.create({
                ...baseRow,
                dedupKey: buildDedupKey({
                    eventKey: evt.key,
                    scope: 'always',
                    entityType: evt.entityType,
                    entityId,
                    recipientEmail: s.email,
                    timezone,
                }),
                recipientEmail: s.email,
                recipientName: s.name || '',
                recipientRole: s.role,
                recipientUserId: s.userId || null,
                status: 'suppressed',
            }, { transaction: options.transaction }).catch(() => {});
        }

        for (const r of resolved.recipients) {
            const dedupKey = buildDedupKey({
                eventKey: evt.key,
                scope: evt.dedupScope,
                entityType: evt.entityType,
                entityId,
                recipientEmail: r.email,
                bucket: options.dedupBucket,
                timezone,
            });

            let log;
            try {
                // The UNIQUE index on dedupKey is the entire never-double-send
                // guarantee. Inserting and catching 1062 rather than checking
                // first means there is no window between the check and the
                // write — the uniqueness test IS the write.
                log = await EmailLog.create({
                    ...baseRow,
                    dedupKey,
                    recipientEmail: r.email,
                    recipientName: r.name || '',
                    recipientRole: r.role,
                    recipientUserId: r.userId || null,
                    status: 'queued',
                }, { transaction: options.transaction });
            } catch (err) {
                if (err.name === 'SequelizeUniqueConstraintError' || err.original?.errno === 1062) {
                    continue; // already sent (or already queued) — exactly right
                }
                throw err;
            }

            const enqueued = await queue.enqueue({
                emailLogId: log.id,
                dedupKey,
                priority: evt.priority,
                runAt: options.runAt || new Date(),
                transaction: options.transaction,
            });

            if (enqueued.queued) queued += 1;
        }

        return {
            queued,
            skipped: resolved.skipped.length + resolved.suppressed.length,
        };
    } catch (err) {
        // The outermost net. Everything above this line may throw; nothing
        // above this line may reach the caller.
        console.error(`[email] dispatch failed for "${eventKey}":`, err.message);
        return { queued: 0, skipped: 0, reason: err.message };
    }
}

module.exports = { sendEmailEvent };
