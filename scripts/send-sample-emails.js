'use strict';

/**
 * Renders real templates and sends them through the configured SMTP transport.
 *
 *   node scripts/send-sample-emails.js you@example.com [eventKey ...]
 *
 * Deliberately bypasses the database: it reads settings from env defaults
 * rather than the settings cache, so the transport and the templates can be
 * proven end-to-end before the DB layer is reachable. It is NOT the normal
 * send path — no queue, no dedup, no delivery log.
 *
 * With no event keys given it sends one representative email per category.
 */

require('dotenv').config();

const registry = require('../emails/registry');
const { render } = require('../emails/templates');
const { buildDefaults } = require('../emails/settings/defaults');
const smtp = require('../emails/transport/smtpTransport');
const { isValidEmail } = require('../emails/recipients/normalize');

// One per category: the emails most worth eyeballing in a real client.
const DEFAULT_SAMPLE = [
    'payment.receipt_issued',        // hand-written plaintext part
    'fee.overdue',                   // warning callout + panel
    'account.created_student',       // credentials block
    'account.password_reset_requested', // the reset flow's email
    'class.cancelled',               // danger callout
    'assignment.graded',             // simple transactional
    'salary.paid',                   // teacher-facing
    'approval.stale',                // admin-facing
    'reminder.class_upcoming',       // lead-time copy
    'digest.parent_progress_weekly', // the loop-over-children digest
];

async function main() {
    const [to, ...requested] = process.argv.slice(2);

    if (!isValidEmail(to)) {
        console.error('\nUsage: node scripts/send-sample-emails.js <to-address> [eventKey ...]\n');
        process.exit(1);
    }
    if (!smtp.isConfigured()) {
        console.error('\nSMTP_HOST is not set — nothing to send through.\n');
        process.exit(1);
    }

    const keys = requested.length > 0 ? requested : DEFAULT_SAMPLE;
    const globals = buildDefaults();

    console.log(`\nSending ${keys.length} sample email(s) to ${to} via ${process.env.SMTP_HOST}\n`);

    let sent = 0;
    const failures = [];

    for (const key of keys) {
        const evt = registry.getEvent(key);
        if (!evt) {
            failures.push({ key, error: 'not in the registry' });
            console.error(`  SKIP  ${key} — not in the registry`);
            continue;
        }

        try {
            const out = render({
                templateName: evt.template,
                category: evt.category,
                data: evt.samplePayload,
                globals,
                recipient: {},
            });

            const info = await smtp.send({
                from: `"${globals['sender.fromName']}" <${globals['sender.fromEmail']}>`,
                to,
                subject: `[SAMPLE] ${out.subject}`,
                html: out.html,
                text: out.text,
                headers: {
                    'X-LMS-Event': key,
                    'Auto-Submitted': 'auto-generated',
                },
            });

            sent += 1;
            console.log(`  SENT  ${key.padEnd(34)} ${out.subject}`);
            console.log(`        id=${info.messageId}`);
        } catch (err) {
            failures.push({ key, error: err.message });
            console.error(`  FAIL  ${key} — ${err.code || ''} ${err.message}`);
        }
    }

    await smtp.close();

    console.log(`\n${sent} sent, ${failures.length} failed.\n`);
    process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error('\nSend run failed:', err.message);
    process.exit(1);
});
