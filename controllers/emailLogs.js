'use strict';

/**
 * Delivery log: browse, inspect, preview and resend.
 *
 * Pagination is keyset on (createdAt, id) rather than OFFSET, because this
 * table only ever grows and a deep OFFSET scan on it would get slower every
 * week.
 */

const { Op, fn, col } = require('sequelize');
const EmailLog = require('../models/EmailLog');
const registry = require('../emails/registry');
const settings = require('../emails/settings/cache');
const templates = require('../emails/templates');
const queue = require('../emails/queue');
const { buildDedupKey } = require('../emails/queue/dedup');

/** GET /api/email-logs */
exports.list = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 50, 200);
        const where = {};

        if (req.query.eventKey) where.eventKey = req.query.eventKey;
        if (req.query.category) where.category = req.query.category;
        if (req.query.status) where.status = String(req.query.status).split(',');
        if (req.query.recipientEmail) {
            where.recipientEmail = { [Op.like]: `%${req.query.recipientEmail}%` };
        }
        if (req.query.entityType) where.entityType = req.query.entityType;
        if (req.query.entityId) where.entityId = req.query.entityId;
        if (req.query.from || req.query.to) {
            where.createdAt = {};
            if (req.query.from) where.createdAt[Op.gte] = new Date(req.query.from);
            if (req.query.to) where.createdAt[Op.lte] = new Date(req.query.to);
        }

        // Keyset cursor: everything strictly older than the last row seen.
        if (req.query.cursor) {
            const cursorId = Number(req.query.cursor);
            if (Number.isFinite(cursorId)) where.id = { [Op.lt]: cursorId };
        }

        const logs = await EmailLog.findAll({
            where,
            // payload can be large and is not needed for the list view.
            attributes: { exclude: ['payload'] },
            order: [['id', 'DESC']],
            limit,
        });

        // Status rollup for the filter chips, over the same filters minus status.
        const rollupWhere = { ...where };
        delete rollupWhere.status;
        delete rollupWhere.id;
        const rollup = await EmailLog.findAll({
            where: rollupWhere,
            attributes: ['status', [fn('COUNT', col('id')), 'count']],
            group: ['status'],
            raw: true,
        });

        res.json({
            logs,
            nextCursor: logs.length === limit ? logs[logs.length - 1].id : null,
            counts: rollup.reduce((acc, r) => ({ ...acc, [r.status]: Number(r.count) }), {}),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * GET /api/email-logs/:id
 *
 * Includes a re-render of the stored payload, so support can see exactly what
 * the recipient saw rather than guessing from a subject line.
 */
exports.get = async (req, res) => {
    try {
        const log = await EmailLog.findByPk(req.params.id);
        if (!log) return res.status(404).json({ message: 'Not found.' });

        let preview = null;
        if (log.payload) {
            try {
                preview = templates.render({
                    templateName: log.templateName,
                    category: log.category,
                    data: log.payload,
                    globals: settings.current().globals,
                    recipient: { name: log.recipientName, role: log.recipientRole },
                });
            } catch (err) {
                // Payload from an older template version may no longer render.
                // That is worth showing, not worth failing the request over.
                preview = { error: `Could not re-render: ${err.message}` };
            }
        }

        const evt = registry.getEvent(log.eventKey);

        res.json({
            log,
            preview,
            event: evt ? { label: evt.label, description: evt.description } : null,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * POST /api/email-logs/:id/resend
 *
 * Creates a NEW log row rather than reusing the original, so the audit trail
 * shows both the first attempt and the resend. The dedup bucket carries a
 * resend counter, which is what lets an otherwise once-ever event go out again
 * without disabling the guarantee for everything else.
 */
exports.resend = async (req, res) => {
    try {
        const original = await EmailLog.findByPk(req.params.id);
        if (!original) return res.status(404).json({ message: 'Not found.' });
        if (!original.payload) {
            return res.status(422).json({
                message: 'This log no longer has its payload stored (payloads are pruned after 90 days), so it cannot be resent.',
            });
        }
        if (!original.recipientEmail) {
            return res.status(422).json({ message: 'This log has no recipient address.' });
        }

        const evt = registry.getEvent(original.eventKey);
        if (!evt) return res.status(422).json({ message: 'That event no longer exists in this version.' });

        const priorResends = await EmailLog.count({ where: { parentLogId: original.id } });

        const copy = await EmailLog.create({
            dedupKey: buildDedupKey({
                eventKey: original.eventKey,
                scope: 'period',
                entityType: original.entityType,
                entityId: original.entityId,
                recipientEmail: original.recipientEmail,
                bucket: require('../emails/queue/dedup').buckets.resend(priorResends + 1),
            }),
            eventKey: original.eventKey,
            category: original.category,
            entityType: original.entityType,
            entityId: original.entityId,
            recipientEmail: original.recipientEmail,
            recipientName: original.recipientName,
            recipientRole: original.recipientRole,
            recipientUserId: original.recipientUserId,
            templateName: original.templateName,
            status: 'queued',
            mode: settings.get('global.mode', 'log'),
            payload: original.payload,
            queuedAt: new Date(),
            parentLogId: original.id,
        });

        await queue.enqueue({
            emailLogId: copy.id,
            dedupKey: copy.dedupKey,
            priority: evt.priority,
            runAt: new Date(),
        });

        console.log(`[emailLogs] admin ${req.userId} resent log ${original.id} as ${copy.id}.`);
        res.json({ message: 'Queued for resend.', logId: copy.id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * GET /api/email-metrics
 * Computed on request — at this volume a rollup table would be premature.
 */
exports.metrics = async (req, res) => {
    try {
        const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 86400_000);
        const to = req.query.to ? new Date(req.query.to) : new Date();
        const groupBy = ['event', 'category', 'day'].includes(req.query.groupBy) ? req.query.groupBy : 'category';

        const groupCol = groupBy === 'event' ? 'eventKey'
            : groupBy === 'category' ? 'category'
                : fn('DATE', col('createdAt'));

        const rows = await EmailLog.findAll({
            where: { createdAt: { [Op.between]: [from, to] } },
            attributes: [
                [groupCol, 'bucket'],
                'status',
                [fn('COUNT', col('id')), 'count'],
            ],
            group: ['bucket', 'status'],
            raw: true,
        });

        const buckets = {};
        for (const r of rows) {
            const key = String(r.bucket);
            buckets[key] = buckets[key] || { bucket: key, sent: 0, failed: 0, dead: 0, skipped: 0, dry_run: 0, other: 0 };
            const n = Number(r.count);
            if (r.status === 'sent') buckets[key].sent += n;
            else if (r.status === 'failed') buckets[key].failed += n;
            else if (r.status === 'dead') buckets[key].dead += n;
            else if (r.status === 'skipped_no_address') buckets[key].skipped += n;
            else if (r.status === 'dry_run') buckets[key].dry_run += n;
            else buckets[key].other += n;
        }

        // Recipients with no address on file: a data-quality task, surfaced
        // rather than left invisible.
        const missingAddresses = await EmailLog.count({
            where: { status: 'skipped_no_address', createdAt: { [Op.between]: [from, to] } },
        });

        res.json({
            groupBy,
            from,
            to,
            buckets: Object.values(buckets).sort((a, b) => a.bucket.localeCompare(b.bucket)),
            missingAddresses,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
