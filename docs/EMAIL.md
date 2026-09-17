# Email subsystem

Transactional email for the LMS: 88 events across payments, salary, accounts,
classes, coursework, approvals, reminders and digests, with per-event admin
toggles, a durable queue and a delivery log.

---

## Quick start

```bash
# 1. Local mail sink — nothing leaves the machine
docker compose up -d mailpit           # SMTP on 1025, inbox at localhost:8025

# 2. Point the app at it
#    (in .env)
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
EMAIL_MODE=live

# 3. Run both processes
npm run dev                            # API
npm run worker                         # email worker (separate terminal)
```

Trigger anything — verify a payment proof, mark a fee paid — and the message
appears at <http://localhost:8025> with HTML, plaintext and source tabs.

### Checks

```bash
npm run email:verify   # renders all 88 templates against their sample payloads
npm run email:check    # cross-checks every wired call site against the registry
npm run email:test     # end-to-end pipeline test (needs a database)
```

`email:verify` and `email:check` need no database and are safe in CI.

---

## How it works

```
controller / cron
      │  sendEmailEvent('fee.overdue', { fee, student })   ← one line, no await
      ▼
  emails/dispatch.js ── resolve recipients ── gate (enabled? mode? go-live? cap?)
      ▼
  INSERT EmailLog (UNIQUE dedupKey)  ──duplicate──→ dropped silently
      ▼
  EmailJobs row   (or a BullMQ job when REDIS_URL is set)
      │
   ═══ process boundary ═══
      ▼
  worker.js → claim (lease) → render → throttle → SMTP → update EmailLog
```

Three properties everything else is built around:

**It cannot break a request.** `sendEmailEvent()` never rejects, does no
rendering and no network, and costs two indexed inserts. If more than
`EMAIL_MAX_ENQUEUE_PER_DISPATCH` (200) recipients resolve, the batch is
*aborted* rather than truncated — a partial send is a silent bug, an aborted one
is a visible incident.

**It cannot send twice.** `EmailLogs.dedupKey` has a unique index, and dispatch
inserts-and-catches rather than checking first, so the uniqueness test *is* the
write and there is no window between them. Workers claim jobs by stamping a
token in a single UPDATE, so two workers provably claim disjoint sets. Attempts
are counted at claim time, so a worker killed mid-send still burns the attempt —
at-most-once is the right bias for email.

**It works without Redis.** The MySQL driver is the default and the reference
implementation. Setting `REDIS_URL` switches the queue to BullMQ with no code,
schema or behaviour change.

---

## Sending modes

| Mode | What happens |
|---|---|
| `off` | Nothing sent, nothing queued. The hard stop. |
| `log` | Fully resolved and rendered, recorded as `dry_run`. **No socket is ever opened.** |
| `sandbox` | Really sends, but every recipient is rewritten to `EMAIL_SANDBOX_TO`. |
| `live` | Normal delivery. |

**The default is `log` in every environment, production included.** Going live
is a deliberate act, not a side effect of a deploy.

Change it in **Settings → Email Notifications**, or set `EMAIL_MODE` in env.

---

## Going live

The first live run is the riskiest moment, because the database is full of
historical fees, sessions and salaries that all look like fresh events. Five
independent guards exist for that; the important one is `EMAIL_GO_LIVE_AT`.

1. **Deploy in `log` mode.** Zero SMTP connections open.
2. **Watch the delivery log for a few days.** Every `dry_run` row shows the real
   subject and the real recipient. This is what would have been sent.
3. **Switch to `sandbox`** with a real inbox and check the formatting.
4. **Enable one category at a time in `live`.** Start with `accounts`, then
   `payments`, then the rest every few days, watching the failure rate.

### `EMAIL_GO_LIVE_AT`

Events whose `occurredAt` predates this timestamp are dropped. It is what
separates "this fee went overdue today" from "this fee went overdue in March",
and it is the only reason the first `markOverdueFees` run does not email months
of history at once. Seeded to the moment of first install; cron call sites pass
the entity's own date (`fee.dueDate`, `salary.dueDate`) rather than `now`.

### Other guards

- Most events ship `defaultEnabled: false` outside the core set.
- Reminder materializers only scan forward.
- `EMAIL_MAX_SENDS_PER_HOUR` (500) trips the mode to `off` and raises a critical
  admin alert. The queue is durable, so nothing is lost — it just stops until a
  human looks.

---

## Admin UI

**Settings → Email Notifications**
- Per-event toggles, grouped by category, with select-all per group
- Sending mode, sender identity, branding, throttle
- Configurable reminder lead times (e.g. `7, 3, 1` days before a fee is due)
- Preview any email, and send a test to any address

**Settings → Delivery Log**
- Every email with its status, filterable by status and recipient
- Opens a record and re-renders the stored payload, so support sees exactly what
  the recipient saw
- Resend button
- Flags recipients with no email address on file as a data-quality task

Permissions: `email:view`, `email:manage`, `email:logs`, `email:test`.

---

## Adding an event

1. Add a definition to the right file in `emails/registry/`:

```js
defineEvent({
    key: 'payments.refund_issued',      // immutable — it is the database key
    category: 'payments',
    label: 'Refund issued',             // UI copy lives here, never in the frontend
    description: 'Sent when a refund is processed against a fee.',
    defaultEnabled: true,
    audiences: ['student', 'parent'],
    template: 'payments/refundIssued',
    entityType: 'fee',
    dedupScope: 'entity',               // entity | entity+day | period | always
    priority: 2,                        // 1 security · 2 money · 3 normal · 4 digest
    samplePayload: { fee: { … }, student: { … } },
}),
```

2. Add the template as a named export in `emails/templates/<category>.js`:

```js
refundIssued: {
    subject: (d) => `Refund issued — ${d.fee.title}`,
    preheader: (d) => `${d.ctx.money(d.fee.amount)} has been refunded.`,
    html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${panel([infoRow('Amount', d.ctx.money(d.fee.amount))])}`,
},
```

**Always build markup with the `` h`` `` tagged literal, never a bare backtick
string.** It escapes every interpolation, which is the only thing stopping a
student whose name contains markup from reaching an admin's inbox as HTML.

3. Fire it from the controller:

```js
sendEmailEvent('payments.refund_issued', { fee, student });   // no await
```

Or alongside an in-app notification:

```js
await notifyStudentAndParent({
    studentId: fee.studentId,
    title: 'Refund issued',
    message: `…`,
    emailEvent: 'payments.refund_issued',
    emailContext: { fee },
});
```

4. Run `npm run email:verify && npm run email:check`.

The event appears in the admin UI automatically. It is seeded on next boot with
`INSERT IGNORE`, so it can never overwrite a toggle an admin has already set.

---

## Environment

SMTP credentials live in env, never the database — the DB is dumped for backups,
the worker needs a transport before it can trust the DB, and the deploy workflow
rewrites `.env` wholesale, so one rotation point is better than two.

| Key | Notes |
|---|---|
| `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` `SMTP_USER` `SMTP_PASS` | Port 465 implies `secure=true`; 587 uses STARTTLS |
| `SMTP_ALLOWED_FROM_DOMAINS` | Stops an admin setting a From the relay will reject |
| `EMAIL_ENABLED` `EMAIL_MODE` | `EMAIL_ENABLED=false` is the break-glass kill switch |
| `EMAIL_FROM_NAME` `EMAIL_FROM_ADDRESS` `EMAIL_REPLY_TO` | Defaults; admin-overridable at runtime |
| `APP_NAME` `APP_LOGO_URL` `SUPPORT_EMAIL` `EMAIL_APP_BASE_URL` | Branding and link defaults |
| `ADMIN_ALERT_EMAILS` | Comma separated; used alongside admins who have an address |
| `EMAIL_SANDBOX_TO` | Required before switching to sandbox mode |
| `EMAIL_CONCURRENCY` `EMAIL_MAX_PER_MINUTE` | Worker throughput |
| `EMAIL_MAX_ENQUEUE_PER_DISPATCH` `EMAIL_MAX_SENDS_PER_HOUR` | Blast radius caps |
| `EMAIL_WORKER_EMBEDDED` | `true` runs the worker in the API process (dev only) |
| `REDIS_URL` | Unset = MySQL queue. Setting it switches to BullMQ. |
| `DB_POOL_MAX` | 15 for the API, 6 for the worker |

**Both GitHub workflows heredoc-write the entire `.env`.** A key missing from
the workflow silently disappears from production on the next push. This is the
most likely way this feature breaks on deploy.

---

## Operations

**"I never got the email."** Open **Settings → Delivery Log**, search the
recipient's address. The status says what happened; `No address` means their
profile has no email on it.

**Queue not draining.** The status panel shows queue depth and the driver. If
`Queued` keeps climbing, the worker is down — `pm2 restart lms-email-worker`.

**Everything failing.** Check the last failure on the status panel. `EAUTH`
means bad SMTP credentials; `ECONNECTION` means the host is unreachable. Both
raise a critical in-app admin alert. Alerts are never sent by email — emailing
about a broken email system is either useless or an infinite loop.

**A worker was killed mid-send.** Safe. Its leases expire and the sweeper
returns the jobs to pending within 60 seconds. The graceful drain is a latency
optimisation, not a correctness requirement.

**Hard bounces** are added to `EmailSuppressions` automatically and skipped from
then on. Remove an address from the list in the settings API if it was wrong.

---

## Known gaps

- **8 registry events have no call site**, because the flows do not exist yet:
  password reset, credential reissue and email change have no endpoints in this
  codebase; `expense.*` and `resource.shared` have no notification points today.
  They are defined and templated, ready for when those flows are built.
- **Open and bounce tracking** columns exist but are not populated. Plain SMTP
  gives no webhooks; this needs either an IMAP bounce poller or a provider that
  offers them. Open-tracking pixels are deliberately not implemented —
  recipients include minors, and blocked images make the number a lie anyway.
- **The nine existing business crons still run in the API process.** Moving them
  to the worker would silently stop real-time socket notifications, because
  `notify()` reaches an in-memory `onlineUsers` map that a second process does
  not share. That needs a Redis socket adapter or an outbox table first.
- **Per-user preferences** are not implemented — toggles are global, as
  specified. The schema leaves room to layer them on later.
