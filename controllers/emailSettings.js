'use strict';

/**
 * Admin API for the email subsystem: the event catalogue, the toggles, global
 * branding/sender settings, a test send, and queue status.
 */

const registry = require('../emails/registry');
const settings = require('../emails/settings/cache');
const store = require('../emails/settings/store');
const queue = require('../emails/queue');
const throttle = require('../emails/throttle');
const templates = require('../emails/templates');
const transport = require('../emails/transport');
const { allowedFromDomains } = require('../emails/settings/defaults');
const EmailSuppression = require('../models/EmailSuppression');
const EmailLog = require('../models/EmailLog');

const CATEGORY_LABELS = {
    payments: 'Payments & Billing',
    salary: 'Salary & Expenses',
    accounts: 'Accounts & Security',
    classes: 'Classes & Scheduling',
    academics: 'Coursework & Results',
    approvals: 'Approvals & Workflow',
    reminders: 'Reminders',
    digests: 'Digests & Summaries',
};

/**
 * GET /api/email-settings/catalog
 *
 * Registry metadata joined to the stored overrides — the single array that
 * drives the whole settings UI. Copy lives in the registry so the frontend
 * never hardcodes an event label.
 */
exports.getCatalog = async (req, res) => {
    try {
        const snap = settings.current();

        const categories = registry.grouped().map(({ category, events }) => ({
            key: category,
            label: CATEGORY_LABELS[category] || category,
            events: events.map((evt) => {
                const eff = snap.events[evt.key] || {};
                return {
                    key: evt.key,
                    label: evt.label,
                    description: evt.description,
                    audiences: evt.audiences,
                    effectiveAudiences: eff.audiences || evt.audiences,
                    enabled: eff.enabled !== undefined ? eff.enabled : evt.defaultEnabled,
                    // The UI renders these toggles disabled with a tooltip; the
                    // API enforces it independently in store.saveEvents().
                    transactional: evt.transactional,
                    critical: evt.critical,
                    priority: evt.priority,
                    config: eff.config || evt.config,
                    configurable: Object.keys(evt.config || {}).length > 0,
                };
            }),
        }));

        // Rows for events no longer in the registry: shown, never auto-deleted.
        const EmailEventSetting = require('../models/EmailEventSetting');
        const rows = await EmailEventSetting.findAll({ attributes: ['eventKey'] });
        const orphaned = rows
            .map((r) => r.eventKey)
            .filter((k) => !registry.getEvent(k));

        res.json({
            categories,
            orphaned,
            totals: {
                events: registry.ALL.length,
                enabled: registry.ALL.filter((e) => {
                    const eff = snap.events[e.key];
                    return eff ? eff.enabled : e.defaultEnabled;
                }).length,
            },
            version: snap.version,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * PUT /api/email-settings/events
 * Body: { updates: [{ eventKey, enabled?, audiences?, config? }] }
 */
exports.updateEvents = async (req, res) => {
    try {
        const { updates } = req.body;
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(422).json({ message: 'updates must be a non-empty array.' });
        }

        const written = await store.saveEvents(updates, req.userId || null);
        // Refresh synchronously so the admin sees their change immediately in
        // this process; other processes pick it up on their next version poll.
        await settings.refreshNow();

        res.json({ message: `${written} event${written === 1 ? '' : 's'} updated.`, written });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/** GET /api/email-settings/global */
exports.getGlobal = async (req, res) => {
    try {
        const g = settings.current().globals;
        res.json({
            settings: g,
            // SMTP lives in env, so the UI shows whether it is configured
            // without ever exposing the credentials themselves.
            smtp: {
                configured: transport.smtp.isConfigured(),
                host: process.env.SMTP_HOST ? String(process.env.SMTP_HOST) : null,
            },
            allowedFromDomains: allowedFromDomains(),
            modes: ['off', 'log', 'sandbox', 'live'],
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/** PUT /api/email-settings/global */
exports.updateGlobal = async (req, res) => {
    try {
        const patch = req.body && req.body.settings;
        if (!patch || typeof patch !== 'object') {
            return res.status(422).json({ message: 'settings object is required.' });
        }

        // A From address the relay will reject breaks ALL outbound mail, not
        // just one message, so this is validated before it can be stored.
        if (patch['sender.fromEmail']) {
            const domains = allowedFromDomains();
            const domain = String(patch['sender.fromEmail']).split('@')[1] || '';
            if (domains.length && !domains.includes(domain.toLowerCase())) {
                return res.status(422).json({
                    message: `From address must use one of these domains: ${domains.join(', ')}`,
                });
            }
        }

        if (patch['global.mode'] && !['off', 'log', 'sandbox', 'live'].includes(patch['global.mode'])) {
            return res.status(422).json({ message: 'Invalid mode.' });
        }
        if (patch['global.mode'] === 'sandbox' && !patch['global.sandboxRedirectTo']
            && !settings.get('global.sandboxRedirectTo')) {
            return res.status(422).json({
                message: 'Set a sandbox redirect address before switching to sandbox mode.',
            });
        }

        const written = await store.saveGlobals(patch, req.userId || null);
        await settings.refreshNow();

        res.json({ message: 'Settings saved.', written });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * GET /api/email-settings/status
 * The one screen to open when someone says "I never got the email".
 */
exports.getStatus = async (req, res) => {
    try {
        const g = settings.current().globals;
        const [stats, lastSent, lastFailed] = await Promise.all([
            queue.stats(),
            EmailLog.findOne({ where: { status: 'sent' }, order: [['sentAt', 'DESC']], attributes: ['sentAt', 'eventKey'] }),
            EmailLog.findOne({
                where: { status: ['failed', 'dead'] },
                order: [['failedAt', 'DESC']],
                attributes: ['failedAt', 'eventKey', 'lastError', 'lastErrorCode'],
            }),
        ]);

        res.json({
            mode: g['global.mode'],
            enabled: g['global.enabled'],
            driver: queue.driverName,
            queue: stats,
            throttle: throttle.headroom(),
            smtpConfigured: transport.smtp.isConfigured(),
            goLiveAt: g['global.goLiveAt'],
            lastSent: lastSent ? { at: lastSent.sentAt, event: lastSent.eventKey } : null,
            lastFailure: lastFailed
                ? {
                    at: lastFailed.failedAt,
                    event: lastFailed.eventKey,
                    error: lastFailed.lastError,
                    code: lastFailed.lastErrorCode,
                }
                : null,
            settingsVersion: settings.current().version,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * POST /api/email-settings/test
 * Body: { eventKey, to }
 *
 * Renders the event against its registry samplePayload and sends it directly,
 * bypassing the queue — a test that sat in a queue behind 400 digests would not
 * tell you anything useful.
 */
exports.sendTest = async (req, res) => {
    try {
        const { eventKey, to } = req.body;
        const evt = registry.getEvent(eventKey);
        if (!evt) return res.status(404).json({ message: `Unknown event "${eventKey}".` });

        const { isValidEmail } = require('../emails/recipients/normalize');
        if (!isValidEmail(to)) return res.status(422).json({ message: 'A valid destination address is required.' });

        const g = settings.current().globals;
        const rendered = templates.render({
            templateName: evt.template,
            category: evt.category,
            data: evt.samplePayload,
            globals: g,
            recipient: {},
        });

        const mode = g['global.mode'] === 'off' ? 'log' : g['global.mode'];
        const message = {
            from: `"${String(g['sender.fromName']).replace(/"/g, '')}" <${g['sender.fromEmail']}>`,
            to,
            subject: `[TEST] ${rendered.subject}`,
            html: rendered.html,
            text: rendered.text,
            headers: { 'X-LMS-Event': eventKey, 'Auto-Submitted': 'auto-generated' },
        };

        const result = await transport.forMode(mode).send(message);

        await EmailLog.create({
            dedupKey: require('../emails/queue/dedup').buildDedupKey({
                eventKey, scope: 'always', recipientEmail: to,
            }),
            eventKey,
            category: evt.category,
            entityType: evt.entityType,
            entityId: null,
            recipientEmail: to,
            recipientName: '',
            recipientRole: 'admin',
            recipientUserId: req.userId || null,
            subject: message.subject,
            templateName: evt.template,
            status: mode === 'log' ? 'dry_run' : 'sent',
            mode: 'test',
            sentAt: new Date(),
            providerMessageId: result.messageId || null,
            payload: evt.samplePayload,
        }).catch(() => {});

        res.json({
            message: mode === 'log'
                ? 'Rendered successfully. Mode is "log", so nothing was actually sent — switch to sandbox or live to receive it.'
                : `Test email sent to ${to}.`,
            mode,
            subject: message.subject,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * GET /api/email-settings/preview/:eventKey
 * Renders the sample payload and returns the HTML, for an in-dashboard preview.
 */
exports.preview = async (req, res) => {
    try {
        const evt = registry.getEvent(req.params.eventKey);
        if (!evt) return res.status(404).json({ message: 'Unknown event.' });

        const rendered = templates.render({
            templateName: evt.template,
            category: evt.category,
            data: evt.samplePayload,
            globals: settings.current().globals,
            recipient: {},
        });

        res.json({ subject: rendered.subject, html: rendered.html, text: rendered.text });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/** GET /api/email-settings/suppressions */
exports.listSuppressions = async (req, res) => {
    try {
        const rows = await EmailSuppression.findAll({ order: [['createdAt', 'DESC']], limit: 500 });
        res.json({ suppressions: rows });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/** DELETE /api/email-settings/suppressions/:id */
exports.removeSuppression = async (req, res) => {
    try {
        const row = await EmailSuppression.findByPk(req.params.id);
        if (!row) return res.status(404).json({ message: 'Not found.' });
        await row.destroy();
        res.json({ message: `${row.email} removed from the do-not-send list.` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
