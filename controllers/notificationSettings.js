'use strict';

/**
 * Admin API for the in-app notification toggles.
 *
 * The registry is the catalog; this only reads and writes overrides. Anything
 * that changes what an event *is* — its audience list, its priority, the titles
 * it emits — belongs in notifications/registry/events.js, so it ships with the
 * controller that fires it.
 */

const registry = require('../notifications/registry');
const settings = require('../notifications/settings/cache');
const store = require('../notifications/settings/store');
const NotificationEventSetting = require('../models/NotificationEventSetting');

const CATEGORY_LABELS = {
    academics: 'Academics',
    classes: 'Classes & Attendance',
    payments: 'Fees & Payments',
    salary: 'Salary',
    accounts: 'Accounts & Plans',
    approvals: 'Approvals',
    reminders: 'Reminders',
    system: 'System & Support',
};

/**
 * GET /api/notification-settings/catalog
 * The whole toggle UI in one response.
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
                    priority: evt.priority,
                    // Everyone the event can reach, vs who it currently reaches.
                    audiences: evt.audiences,
                    effectiveAudiences: eff.audiences || evt.audiences,
                    enabled: eff.enabled !== undefined ? eff.enabled : evt.defaultEnabled,
                    // The UI renders these locked with a tooltip; store.saveEvents()
                    // enforces it again so a crafted request cannot bypass the UI.
                    transactional: !!evt.transactional,
                    titles: evt.titles,
                };
            }),
        }));

        // Rows for events no longer in the registry: surfaced, never auto-deleted.
        const rows = await NotificationEventSetting.findAll({ attributes: ['eventKey'] });
        const orphaned = rows
            .map((r) => r.eventKey)
            .filter((k) => !registry.getEvent(k));

        const enabledCount = registry.ALL.filter((e) => {
            const eff = snap.events[e.key];
            return eff ? eff.enabled : e.defaultEnabled;
        }).length;

        res.json({
            categories,
            orphaned,
            totals: {
                events: registry.ALL.length,
                enabled: enabledCount,
                locked: registry.ALL.filter((e) => e.transactional).length,
            },
            version: snap.version,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * PUT /api/notification-settings/events
 * Body: { updates: [{ eventKey, enabled?, audiences? }] }
 *
 * `skipped` names the keys that were ignored — unknown, or locked — so the UI
 * can say why a toggle bounced back instead of silently reverting.
 */
exports.updateEvents = async (req, res) => {
    try {
        const { updates } = req.body;
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ message: 'updates must be a non-empty array.' });
        }

        const { written, skipped } = await store.saveEvents(updates, req.userId || null);
        await settings.refreshNow();

        res.json({
            message: `${written} event(s) updated.`,
            written,
            skipped,
            version: settings.current().version,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * PUT /api/notification-settings/categories/:category
 * Body: { enabled: boolean }
 *
 * A master switch for a whole category. Locked events are skipped, so this can
 * never silently switch off a security or receipt notification.
 */
exports.updateCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ message: 'enabled must be a boolean.' });
        }
        if (!registry.CATEGORIES.includes(category)) {
            return res.status(404).json({ message: `Unknown category "${category}".` });
        }

        const updates = registry.ALL
            .filter((e) => e.category === category && !e.transactional)
            .map((e) => ({ eventKey: e.key, enabled }));

        if (updates.length === 0) {
            return res.json({ message: 'Nothing to update — every event here is locked.', written: 0 });
        }

        const { written, skipped } = await store.saveEvents(updates, req.userId || null);
        await settings.refreshNow();

        res.json({
            message: `${written} event(s) in "${category}" ${enabled ? 'enabled' : 'disabled'}.`,
            written,
            skipped,
            version: settings.current().version,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * GET /api/notification-settings/status
 * Small payload for a dashboard widget or a health check.
 */
exports.getStatus = async (req, res) => {
    try {
        const snap = settings.current();
        const disabled = registry.ALL
            .filter((e) => snap.events[e.key] && !snap.events[e.key].enabled)
            .map((e) => ({ key: e.key, label: e.label }));

        res.json({
            version: snap.version,
            loadedAt: snap.loadedAt,
            totals: {
                events: registry.ALL.length,
                enabled: registry.ALL.length - disabled.length,
                disabled: disabled.length,
                locked: registry.ALL.filter((e) => e.transactional).length,
            },
            disabled,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
