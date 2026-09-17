'use strict';

/**
 * End-to-end pipeline test. Requires a reachable database.
 *
 *   npm run email:test
 *
 * Exercises the three properties the whole design rests on:
 *
 *   1. The same dedup key enqueues exactly once — the never-double-send
 *      guarantee, enforced by a UNIQUE index rather than an application check.
 *   2. Two concurrent claim rounds return disjoint job sets — no two workers
 *      can pick up the same email.
 *   3. A job travels queued -> sent, with the message reaching the transport.
 *
 * Everything runs against a memory transport, so no mail leaves the machine and
 * no SMTP server is needed. Test rows are cleaned up at the end.
 */

process.env.EMAIL_TEST_TRANSPORT = 'memory';

require('dotenv').config();
require('../models/association');

const sequelize = require('../utils/database');
const EmailLog = require('../models/EmailLog');
const EmailJob = require('../models/EmailJob');
const { patchEmailSchema, verifyDedupIndex } = require('../emails/schema-patch');
const { seedEmailSettings } = require('../emails/settings/seed');
const settings = require('../emails/settings/cache');
const store = require('../emails/settings/store');
const queue = require('../emails/queue');
const mysqlDriver = require('../emails/queue/mysqlDriver');
const processor = require('../emails/processor');
const memoryTransport = require('../emails/transport/memoryTransport');
const { sendEmailEvent } = require('../emails');

const TEST_EMAIL = 'pipeline-test@example.invalid';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
    if (condition) {
        passed += 1;
        console.log(`  PASS  ${name}`);
    } else {
        failed += 1;
        console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

async function cleanup() {
    const logs = await EmailLog.findAll({
        where: { recipientEmail: TEST_EMAIL },
        attributes: ['id'],
    });
    const ids = logs.map((l) => l.id);
    if (ids.length) {
        await EmailJob.destroy({ where: { emailLogId: ids } });
        await EmailLog.destroy({ where: { id: ids } });
    }
}

async function main() {
    await sequelize.authenticate();
    console.log('\nDatabase connected.\n');

    await patchEmailSchema();
    await seedEmailSettings();
    await settings.start();

    // The whole guarantee rests on this one index.
    check('unique index uq_emaillog_dedup exists', await verifyDedupIndex());

    // Sending must be on for the test, whatever the deployment is set to.
    const originalMode = settings.get('global.mode');
    await store.saveGlobals({ 'global.mode': 'live', 'global.goLiveAt': null }, null);
    await settings.refreshNow();

    await cleanup();
    memoryTransport.reset();

    const recipient = [{
        email: TEST_EMAIL,
        name: 'Pipeline Test',
        role: 'student',
        userId: null,
        timeZone: null,
        source: 'db',
    }];

    const context = {
        fee: { id: 999999, title: 'Pipeline Test Fee', amount: '100.00', dueDate: '2026-01-01', paidDate: '2026-01-01' },
        student: { id: 999999, firstName: 'Pipeline', lastName: 'Test' },
        __recipients: recipient,
    };

    // --- 1. dedup ----------------------------------------------------------
    console.log('1. Deduplication');
    const first = await sendEmailEvent('payment.proof_verified', context);
    const second = await sendEmailEvent('payment.proof_verified', context);

    check('first dispatch queues one email', first.queued === 1, `got ${first.queued}`);
    check('identical second dispatch queues nothing', second.queued === 0, `got ${second.queued}`);

    const logCount = await EmailLog.count({ where: { recipientEmail: TEST_EMAIL } });
    check('exactly one log row exists', logCount === 1, `found ${logCount}`);

    // --- 2. concurrent claims ---------------------------------------------
    console.log('\n2. Concurrent claims');
    // Queue a few more so there is something to contend over.
    for (let i = 0; i < 4; i += 1) {
        await sendEmailEvent('payment.proof_verified', {
            ...context,
            fee: { ...context.fee, id: 999990 + i },
        });
    }

    const [batchA, batchB] = await Promise.all([
        mysqlDriver.claim(10),
        mysqlDriver.claim(10),
    ]);
    const idsA = new Set(batchA.map((j) => j.id));
    const overlap = batchB.filter((j) => idsA.has(j.id));

    check(
        'two concurrent claims return disjoint sets',
        overlap.length === 0,
        `${overlap.length} job(s) claimed twice`
    );
    check('claims returned work', batchA.length + batchB.length > 0);

    // Hand them back so the send test can pick them up.
    for (const job of [...batchA, ...batchB]) {
        await EmailJob.update(
            { status: 'pending', claimToken: null, lockedBy: null, leaseExpiresAt: null, attempts: 0 },
            { where: { id: job.id } }
        );
    }

    // --- 3. send ----------------------------------------------------------
    console.log('\n3. Delivery');
    const toSend = await mysqlDriver.claim(10);
    for (const job of toSend) {
        await processor.handle(job);
    }

    const sent = memoryTransport.messages();
    check('messages reached the transport', sent.length > 0, `${sent.length} sent`);

    if (sent.length > 0) {
        const m = sent[0];
        check('message has a subject', Boolean(m.subject), JSON.stringify(m.subject));
        check('message has an HTML part', Boolean(m.html) && m.html.includes('<!DOCTYPE'));
        check('message has a plaintext part', Boolean(m.text) && m.text.length > 10);
        check('message is addressed to the recipient', m.to === TEST_EMAIL, m.to);
        check('message carries the event header', m.headers && m.headers['X-LMS-Event'] === 'payment.proof_verified');
    }

    const sentLogs = await EmailLog.count({ where: { recipientEmail: TEST_EMAIL, status: 'sent' } });
    check('log rows marked sent', sentLogs > 0, `${sentLogs} marked sent`);

    const leftoverJobs = await EmailJob.count({
        where: { emailLogId: (await EmailLog.findAll({ where: { recipientEmail: TEST_EMAIL }, attributes: ['id'] })).map((l) => l.id) },
    });
    check('successful jobs are removed from the queue', leftoverJobs === 0, `${leftoverJobs} left`);

    // --- 4. disabled events -----------------------------------------------
    console.log('\n4. Admin toggle');
    await store.saveEvents([{ eventKey: 'fee.overdue', enabled: false }], null);
    await settings.refreshNow();

    const blocked = await sendEmailEvent('fee.overdue', {
        fee: { id: 999995, title: 'Should not send', amount: '1.00', dueDate: '2026-01-01' },
        __recipients: recipient,
    });
    check('a switched-off event queues nothing', blocked.queued === 0, blocked.reason || '');

    // A transactional event ignores the toggle entirely.
    await store.saveEvents([{ eventKey: 'payment.receipt_issued', enabled: false }], null);
    await settings.refreshNow();
    const transactional = await sendEmailEvent('payment.receipt_issued', {
        payment: { id: 999994, amount: '1.00', paidOn: '2026-01-01' },
        __recipients: recipient,
    });
    check(
        'a transactional event still sends when switched off',
        transactional.queued === 1,
        transactional.reason || `queued ${transactional.queued}`
    );

    // --- restore ----------------------------------------------------------
    await store.saveEvents(
        [{ eventKey: 'fee.overdue', enabled: true }, { eventKey: 'payment.receipt_issued', enabled: true }],
        null
    );
    await store.saveGlobals({ 'global.mode': originalMode }, null);
    await cleanup();
    await settings.stop();

    console.log(`\n${passed} passed, ${failed} failed.\n`);
    await sequelize.close();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
    console.error('\nTest run failed:', err.message);
    if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND/.test(err.message)) {
        console.error('\nThe database is not reachable. Start it first:\n  docker compose up -d mysql\n');
    }
    try { await cleanup(); } catch (_) { /* nothing more to do */ }
    process.exit(1);
});
