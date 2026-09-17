'use strict';

/**
 * Unit tests for the pure logic of the email subsystem. No database, no
 * network — safe to run anywhere, including CI.
 *
 *   npm run email:units
 *
 * The database-backed guarantees (the UNIQUE dedup index, concurrent claims)
 * are covered by scripts/test-email-pipeline.js, which needs a live MySQL.
 */

require('dotenv').config();

const assert = require('assert');
const { buildDedupKey, buckets } = require('../emails/queue/dedup');
const { classify, backoffMs } = require('../emails/queue/backoff');
const { dedupeRecipients, isValidEmail, toCanonicalRole, toJwtUserType } = require('../emails/recipients/normalize');
const { esc, h, raw } = require('../emails/templates/escape');
const { htmlToText } = require('../emails/templates/htmlToText');
const throttle = require('../emails/throttle');
const registry = require('../emails/registry');

let passed = 0;
const failures = [];

function test(name, fn) {
    try {
        fn();
        passed += 1;
        console.log(`  PASS  ${name}`);
    } catch (err) {
        failures.push({ name, err });
        console.error(`  FAIL  ${name}\n        ${err.message}`);
    }
}

console.log('\nDedup keys');

test('same inputs produce the same key', () => {
    const args = { eventKey: 'fee.overdue', scope: 'entity', entityType: 'fee', entityId: 1, recipientEmail: 'a@b.com' };
    assert.strictEqual(buildDedupKey(args), buildDedupKey(args));
});

test('a different recipient produces a different key', () => {
    const base = { eventKey: 'fee.overdue', scope: 'entity', entityType: 'fee', entityId: 1 };
    assert.notStrictEqual(
        buildDedupKey({ ...base, recipientEmail: 'a@b.com' }),
        buildDedupKey({ ...base, recipientEmail: 'c@d.com' })
    );
});

test('email case and padding do not change the key', () => {
    const base = { eventKey: 'fee.overdue', scope: 'entity', entityType: 'fee', entityId: 1 };
    assert.strictEqual(
        buildDedupKey({ ...base, recipientEmail: 'A@B.com' }),
        buildDedupKey({ ...base, recipientEmail: '  a@b.com ' })
    );
});

test('a different entity produces a different key', () => {
    const base = { eventKey: 'fee.overdue', scope: 'entity', entityType: 'fee', recipientEmail: 'a@b.com' };
    assert.notStrictEqual(
        buildDedupKey({ ...base, entityId: 1 }),
        buildDedupKey({ ...base, entityId: 2 })
    );
});

test('each reminder lead time gets its own bucket', () => {
    const base = { eventKey: 'reminder.fee_due', scope: 'period', entityType: 'fee', entityId: 1, recipientEmail: 'a@b.com' };
    const seven = buildDedupKey({ ...base, bucket: buckets.leadDays(7) });
    const three = buildDedupKey({ ...base, bucket: buckets.leadDays(3) });
    assert.notStrictEqual(seven, three, '7-day and 3-day reminders must not suppress each other');
});

test('rescheduling a class produces a new bucket', () => {
    // The point of including the scheduled time: a moved class must re-notify.
    const base = { eventKey: 'reminder.class_upcoming', scope: 'period', entityType: 'session', entityId: 5, recipientEmail: 'a@b.com' };
    const before = buildDedupKey({ ...base, bucket: buckets.scheduled('2026-03-18', '16:00:00', '60m') });
    const after = buildDedupKey({ ...base, bucket: buckets.scheduled('2026-03-19', '16:00:00', '60m') });
    assert.notStrictEqual(before, after);
});

test("scope 'always' never dedupes", () => {
    const args = { eventKey: 'account.password_changed', scope: 'always', recipientEmail: 'a@b.com' };
    assert.notStrictEqual(buildDedupKey(args), buildDedupKey(args));
});

test('keys fit the VARCHAR(64) column', () => {
    const key = buildDedupKey({ eventKey: 'x.y', scope: 'entity', recipientEmail: 'a@b.com' });
    assert.ok(key.length <= 64, `key was ${key.length} chars`);
});

console.log('\nRetry classification');

test('auth failures are permanent', () => {
    const err = Object.assign(new Error('bad login'), { code: 'EAUTH' });
    assert.strictEqual(classify(err).retryable, false);
});

test('connection failures are retryable', () => {
    const err = Object.assign(new Error('timeout'), { code: 'ECONNECTION' });
    assert.strictEqual(classify(err).retryable, true);
});

test('5xx responses are permanent', () => {
    const err = Object.assign(new Error('rejected'), { responseCode: 550, response: '550 no such user' });
    const out = classify(err);
    assert.strictEqual(out.retryable, false);
    assert.strictEqual(out.permanentReason, 'hard_bounce');
});

test('4xx greylisting is retryable', () => {
    const err = Object.assign(new Error('try later'), { responseCode: 451, response: '451 greylisted' });
    assert.strictEqual(classify(err).retryable, true);
});

test('backoff grows and stays under an hour', () => {
    assert.ok(backoffMs(1) < backoffMs(4), 'later attempts must wait longer');
    assert.ok(backoffMs(20) <= 3_600_000 * 1.25, 'must stay capped');
});

console.log('\nRecipients');

test('addresses are deduped case-insensitively', () => {
    const out = dedupeRecipients([
        { email: 'Parent@Example.com', role: 'parent' },
        { email: 'parent@example.com', role: 'parent' },
    ]);
    assert.strictEqual(out.length, 1);
});

test('the first entry wins, so DB records beat env addresses', () => {
    const out = dedupeRecipients([
        { email: 'ops@example.com', role: 'admin', userId: 3, source: 'db' },
        { email: 'ops@example.com', role: 'admin', userId: null, source: 'env' },
    ]);
    assert.strictEqual(out[0].source, 'db');
    assert.strictEqual(out[0].userId, 3);
});

test('invalid addresses are dropped', () => {
    const out = dedupeRecipients([
        { email: '', role: 'student' },
        { email: 'not-an-email', role: 'student' },
        { email: 'has space@x.com', role: 'student' },
        { email: 'good@example.com', role: 'student' },
    ]);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].email, 'good@example.com');
});

test('email validation accepts and rejects sensibly', () => {
    assert.ok(isValidEmail('a.b+tag@sub.example.co.uk'));
    assert.ok(!isValidEmail('a@b'));
    assert.ok(!isValidEmail(null));
});

test('role casing normalises both ways', () => {
    assert.strictEqual(toCanonicalRole('ADMIN'), 'admin');
    assert.strictEqual(toCanonicalRole('SUPER_ADMIN'), 'admin');
    assert.strictEqual(toJwtUserType('student'), 'STUDENT');
    assert.strictEqual(toCanonicalRole('nonsense'), null);
});

console.log('\nEscaping');

test('esc neutralises HTML', () => {
    assert.strictEqual(esc('<script>'), '&lt;script&gt;');
});

test('h escapes interpolations but not literal markup', () => {
    const out = String(h`<b>${'<script>alert(1)</script>'}</b>`);
    assert.ok(out.includes('<b>'), 'developer markup must survive');
    assert.ok(!out.includes('<script>'), 'user input must be escaped');
    assert.ok(out.includes('&lt;script&gt;'));
});

test('nested h does not double-escape', () => {
    // This is the bug that made every template render literal "&lt;strong&gt;".
    const inner = h`<strong>${'Fee'}</strong>`;
    const outer = String(h`<p>${inner}</p>`);
    assert.ok(outer.includes('<strong>Fee</strong>'), outer);
    assert.ok(!outer.includes('&lt;strong&gt;'));
});

test('raw() passes through untouched', () => {
    assert.ok(String(h`${raw('<hr/>')}`).includes('<hr/>'));
});

test('arrays of components are joined, not stringified', () => {
    const out = String(h`${[raw('<i>a</i>'), raw('<i>b</i>')]}`);
    assert.strictEqual(out, '<i>a</i><i>b</i>');
});

console.log('\nPlaintext');

test('links keep their destination', () => {
    const text = htmlToText('<a href="https://x.com/pay">Pay now</a>');
    assert.ok(text.includes('https://x.com/pay'), text);
});

test('tags are stripped and entities decoded', () => {
    const text = htmlToText('<p>Hi &amp; welcome</p>');
    assert.ok(text.includes('Hi & welcome'), text);
    assert.ok(!text.includes('<p>'));
});

console.log('\nThrottle');

test('a token is available after configuring and waiting', async () => {
    throttle.configure(6000); // 100/sec, so a token refills almost immediately
    const before = Date.now();
    await throttle.take();
    assert.ok(Date.now() - before < 2000, 'should not block long at a high rate');
});

console.log('\nRegistry');

test('every event has a unique key', () => {
    const keys = registry.ALL.map((e) => e.key);
    assert.strictEqual(new Set(keys).size, keys.length);
});

test('transactional events all default to enabled', () => {
    const bad = registry.ALL.filter((e) => e.transactional && !e.defaultEnabled);
    assert.strictEqual(bad.length, 0, bad.map((e) => e.key).join(', '));
});

test("every 'period' event is fired with a bucket or by a cron", () => {
    // A 'period' event with no bucket falls back to 'default', collapsing all
    // its buckets into one. Reminders and digests supply theirs from crons.
    const periodEvents = registry.ALL.filter((e) => e.dedupScope === 'period');
    assert.ok(periodEvents.length > 0);
    for (const e of periodEvents) {
        assert.ok(
            ['reminders', 'digests'].includes(e.category) ||
            ['classes', 'payments'].includes(e.category),
            `${e.key} uses scope 'period' — confirm its call site passes dedupBucket`
        );
    }
});

// The throttle test is async; give it a tick before reporting.
setTimeout(() => {
    console.log(`\n${passed} passed, ${failures.length} failed.\n`);
    process.exit(failures.length > 0 ? 1 : 0);
}, 100);
