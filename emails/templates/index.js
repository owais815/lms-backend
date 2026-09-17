'use strict';

/**
 * Template loader and renderer.
 *
 * Templates are leaf modules exporting { subject, preheader, html, text }.
 * They import nothing but ./escape and ./components, which makes each one
 * trivially unit-testable and keeps the dependency graph flat.
 *
 * Every template receives a `ctx` helper bag so that date and currency
 * formatting is written once rather than eighty-nine times.
 */

const path = require('path');
const moment = require('moment-timezone');
const { htmlToText } = require('./htmlToText');
const { renderLayout } = require('./layout');

const CATEGORY_LABELS = {
    payments: 'billing',
    salary: 'payroll',
    accounts: 'account',
    classes: 'class schedule',
    academics: 'coursework',
    approvals: 'workflow',
    reminders: 'reminder',
    digests: 'summary',
};

/**
 * Resolve a template name like 'payments/proofVerified'.
 *
 * Templates are grouped one module per category, each exporting its templates
 * as named keys. Eighty-nine separate files would all import the same two
 * modules and repeat the same eight-line preamble; grouping keeps related copy
 * side by side where inconsistencies in tone are actually visible.
 *
 * A standalone file at the same path still wins if one exists, so an unusually
 * large template can be split out without changing its key.
 *
 * require() caches, so this is cheap after the first call.
 */
function loadTemplate(name) {
    const [group, key] = String(name).split('/');

    if (group && key) {
        // eslint-disable-next-line global-require, import/no-dynamic-require
        const mod = require(path.join(__dirname, group));
        if (mod && typeof mod[key] === 'object' && mod[key]) return mod[key];
        throw new Error(
            `[emailTemplates] template "${name}" not found — ` +
            `emails/templates/${group}.js does not export "${key}".`
        );
    }

    try {
        // eslint-disable-next-line global-require, import/no-dynamic-require
        return require(path.join(__dirname, name));
    } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') {
            throw new Error(`[emailTemplates] template "${name}" not found under emails/templates/.`);
        }
        throw err;
    }
}

/**
 * Build the per-render helper bag.
 *
 * Times are rendered in the recipient's own timezone when their record has one
 * (Student.timeZone exists in this schema), falling back to the institution
 * timezone. A class reminder that shows the wrong local time is worse than no
 * reminder at all.
 *
 * @param {Object} globals settings snapshot globals
 * @param {Object} [recipient]
 */
function buildCtx(globals, recipient = {}) {
    const tz = recipient.timeZone || globals['global.timezone'] || 'Asia/Karachi';
    const currency = globals['global.currency'] || 'PKR';
    const appUrl = String(globals['links.appBaseUrl'] || '').replace(/\/+$/, '');

    const asMoment = (value) => {
        if (!value) return null;
        // DATEONLY columns arrive as 'YYYY-MM-DD' and must not be shifted by tz.
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return moment.tz(value, 'YYYY-MM-DD', tz);
        }
        const m = moment.tz(value, tz);
        return m.isValid() ? m : null;
    };

    return {
        appUrl,
        brand: globals['branding.brandName'] || 'LMS',
        primaryColor: globals['branding.primaryColor'] || '#2E37A4',
        supportEmail: globals['footer.supportEmail'] || '',
        timeZone: tz,

        /** Format an amount with the configured currency code. */
        money: (n) => {
            const value = Number(n);
            if (!Number.isFinite(value)) return `${currency} 0.00`;
            return `${currency} ${value.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}`;
        },

        date: (d) => { const m = asMoment(d); return m ? m.format('D MMM YYYY') : '—'; },
        time: (d) => { const m = asMoment(d); return m ? m.format('h:mm A') : '—'; },
        dateTime: (d) => { const m = asMoment(d); return m ? m.format('D MMM YYYY, h:mm A') : '—'; },

        /** Combine a DATEONLY date with a TIME column, as ClassSession stores them. */
        dateAndTime: (date, time) => {
            if (!date) return '—';
            const m = moment.tz(`${String(date).slice(0, 10)} ${String(time || '00:00:00')}`, 'YYYY-MM-DD HH:mm:ss', tz);
            return m.isValid() ? m.format('D MMM YYYY, h:mm A') : '—';
        },

        plural: (n, one, many) => (Number(n) === 1 ? one : many),

        /** Full name from any record with firstName/lastName, or a name field. */
        name: (u) => {
            if (!u) return 'there';
            if (u.firstName || u.lastName) return [u.firstName, u.lastName].filter(Boolean).join(' ');
            return u.name || u.username || 'there';
        },
    };
}

/**
 * Render one email.
 *
 * @param {Object} opts
 * @param {string} opts.templateName  e.g. 'payments/proofVerified'
 * @param {string} opts.category      for the footer's "why am I getting this"
 * @param {Object} opts.data          template payload
 * @param {Object} opts.globals       settings snapshot globals
 * @param {Object} [opts.recipient]
 * @returns {{subject:string, html:string, text:string}}
 */
function render({ templateName, category, data, globals, recipient = {} }) {
    const tpl = loadTemplate(templateName);
    const ctx = buildCtx(globals, recipient);
    const d = { ...data, ctx, recipient };

    const subject = String(tpl.subject(d) || '').trim();
    const preheader = tpl.preheader ? String(tpl.preheader(d) || '').trim() : '';
    const bodyHtml = String(tpl.html(d));

    const html = renderLayout({
        subject,
        preheader,
        bodyHtml,
        branding: {
            brandName: globals['branding.brandName'],
            logoUrl: globals['branding.logoUrl'],
            primaryColor: globals['branding.primaryColor'],
        },
        footer: {
            address: globals['footer.address'],
            supportEmail: globals['footer.supportEmail'],
            note: globals['footer.note'],
        },
        categoryLabel: CATEGORY_LABELS[category] || '',
    });

    // A hand-written text() is worth it for credentials and receipts; for the
    // rest the generated fallback is honest and saves ninety hand-written copies.
    const text = tpl.text ? String(tpl.text(d)) : htmlToText(html);

    return { subject, html, text };
}

module.exports = { render, buildCtx, loadTemplate, CATEGORY_LABELS };
