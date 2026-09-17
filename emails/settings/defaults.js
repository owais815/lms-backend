'use strict';

/**
 * Env-derived defaults for every global setting.
 *
 * Resolution order everywhere in the subsystem: DB row -> env default ->
 * the hardcoded fallback in this file. Nothing reads process.env directly
 * outside of here and the transport.
 *
 * SMTP credentials are deliberately absent: they live in env only and are read
 * by emails/transport. Putting them in the DB would spread them into every
 * backup dump, would leave the worker unable to build a transport before it can
 * reach the database, and would split credential rotation across two systems —
 * while the deploy workflow rewrites .env wholesale on every push anyway.
 */

const num = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};

const list = (v) =>
    String(v || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

/**
 * Default mode is 'log' in EVERY environment, production included.
 *
 * That is deliberate. Going live is an explicit decision someone makes after
 * reviewing what the system *would* have sent, not something that happens as a
 * side effect of a deploy. It is also the outermost layer of the first-boot
 * flood guard: on the deploy that ships this code, zero SMTP connections open.
 */
const DEFAULT_MODE = 'log';

function buildDefaults() {
    const env = process.env;

    return {
        // --- global ---------------------------------------------------------
        'global.enabled': env.EMAIL_ENABLED !== 'false',
        'global.mode': env.EMAIL_MODE || DEFAULT_MODE,
        'global.throttlePerMinute': num(env.EMAIL_MAX_PER_MINUTE, 60),
        'global.maxEnqueuePerDispatch': num(env.EMAIL_MAX_ENQUEUE_PER_DISPATCH, 200),
        'global.maxSendsPerHour': num(env.EMAIL_MAX_SENDS_PER_HOUR, 500),
        'global.sandboxRedirectTo': env.EMAIL_SANDBOX_TO || '',
        'global.timezone': env.EMAIL_TIMEZONE || 'Asia/Karachi',
        'global.currency': env.EMAIL_CURRENCY || 'PKR',
        'global.adminAlertEmails': list(env.ADMIN_ALERT_EMAILS),
        // Events that occurred before this instant are never emailed. This is
        // what stops the overdue-fees cron mailing six months of history on its
        // first live run. Seeded to "now" on a fresh install.
        'global.goLiveAt': env.EMAIL_GO_LIVE_AT || null,

        // --- sender ---------------------------------------------------------
        'sender.fromName': env.EMAIL_FROM_NAME || env.APP_NAME || 'LMS',
        'sender.fromEmail': env.EMAIL_FROM_ADDRESS || env.SMTP_USER || 'no-reply@localhost',
        'sender.replyTo': env.EMAIL_REPLY_TO || '',

        // --- branding -------------------------------------------------------
        'branding.brandName': env.APP_NAME || 'LMS',
        'branding.logoUrl': env.APP_LOGO_URL || '',
        'branding.primaryColor': env.APP_PRIMARY_COLOR || '#2E37A4',
        'branding.accentColor': env.APP_ACCENT_COLOR || '#3D5EE1',

        // --- footer ---------------------------------------------------------
        'footer.address': env.APP_ADDRESS || '',
        'footer.supportEmail': env.SUPPORT_EMAIL || '',
        'footer.note': env.EMAIL_FOOTER_NOTE || '',

        // --- links ----------------------------------------------------------
        'links.appBaseUrl': env.EMAIL_APP_BASE_URL || env.CORS_ORIGIN_PROD || 'http://localhost:3001',
    };
}

/**
 * Domains an admin-supplied From address is allowed to use.
 * Empty list = no restriction.
 *
 * This exists because an admin who sets a From address the relay will not
 * accept breaks *all* outbound mail, not just their own message.
 */
function allowedFromDomains() {
    return list(process.env.SMTP_ALLOWED_FROM_DOMAINS);
}

module.exports = { buildDefaults, allowedFromDomains, DEFAULT_MODE };
