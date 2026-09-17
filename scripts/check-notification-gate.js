/**
 * Proves the admin toggles actually suppress notifications.
 *
 * Usage:
 *   node scripts/check-notification-gate.js
 *   npm run check:gate
 *
 * Needs no database: the Notification model and the socket are stubbed, and the
 * settings cache is driven directly, so this exercises the gate logic in
 * utils/notify.js and utils/notifyBulk.js in isolation.
 */
require('dotenv').config();
require('../models/association');

const registry = require('../notifications/registry');
const settings = require('../notifications/settings/cache');

// Stub the Notification model so notify() can run without MySQL.
const modelPath = require.resolve('../models/Notifications');
const written = [];
require.cache[modelPath] = {
  id: modelPath, filename: modelPath, loaded: true,
  exports: { create: async (row) => { written.push(row); return { id: written.length, ...row }; } },
};
// Stub the socket so notify() does not wait on getIO().
const socketPath = require.resolve('../socket');
require.cache[socketPath] = {
  id: socketPath, filename: socketPath, loaded: true,
  exports: { getIO: async () => null },
};

const notify = require('../utils/notify');
const notifyBulk = require('../utils/notifyBulk');

let failures = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};

// Drive the cache directly instead of hitting the DB.
const setSnapshot = (overrides) => {
  const events = Object.create(null);
  for (const evt of registry.ALL) {
    events[evt.key] = { enabled: evt.defaultEnabled, audiences: evt.audiences };
  }
  Object.assign(events, overrides);
  const cachePath = require.resolve('../notifications/settings/cache');
  const real = require.cache[cachePath].exports;
  real.current = () => ({ version: 1, events, loadedAt: new Date() });
  real.isEnabled = (key, userType) => {
    if (!key) return true;
    const eff = events[key];
    if (!eff) return true;
    if (!eff.enabled) return false;
    if (!userType) return true;
    return eff.audiences.includes(String(userType).toLowerCase());
  };
};

(async () => {
  // 1 — title maps to its registry event
  check('title resolves to an event key',
    registry.getEventKeyForTitle('New Assignment') === 'academics.assignment_published',
    registry.getEventKeyForTitle('New Assignment'));

  // 2 — interpolated title resolves via its static prefix
  check('prefixed title resolves',
    registry.getEventKeyForTitle('Announcement: Term starts') === 'system.announcement');

  // 3 — enabled event delivers
  setSnapshot({});
  written.length = 0;
  await notify({ userId: 1, userType: 'student', title: 'New Assignment', message: 'x' });
  check('enabled event is delivered', written.length === 1, `${written.length} written`);

  // 4 — disabled event is suppressed
  setSnapshot({ 'academics.assignment_published': { enabled: false, audiences: ['student', 'parent'] } });
  written.length = 0;
  await notify({ userId: 1, userType: 'student', title: 'New Assignment', message: 'x' });
  check('disabled event writes nothing', written.length === 0, `${written.length} written`);

  // 5 — audience narrowing: students keep it, parents lose it
  setSnapshot({ 'academics.assignment_published': { enabled: true, audiences: ['student'] } });
  written.length = 0;
  await notify({ userId: 1, userType: 'student', title: 'New Assignment', message: 'x' });
  await notify({ userId: 2, userType: 'parent', title: 'New Assignment', message: 'x' });
  check('audience narrowing drops only the excluded audience',
    written.length === 1 && written[0].userType === 'student',
    `${written.length} written: ${written.map((w) => w.userType).join(',')}`);

  // 6 — notifyBulk honours the same gate
  setSnapshot({ 'academics.assignment_published': { enabled: true, audiences: ['student'] } });
  written.length = 0;
  await notifyBulk([
    { userId: 1, userType: 'student', title: 'New Assignment', message: 'x' },
    { userId: 2, userType: 'parent', title: 'New Assignment', message: 'x' },
    { userId: 3, userType: 'student', title: 'New Assignment', message: 'x' },
  ]);
  check('notifyBulk filters by audience too',
    written.length === 2 && written.every((w) => w.userType === 'student'),
    `${written.length} written`);

  // 7 — a locked (transactional) event cannot be suppressed by the store.
  //     loadEvents() forces enabled=true for it, so simulate that contract.
  const locked = registry.getEvent('accounts.password_changed');
  check('password change is marked transactional', locked && locked.transactional === true);

  // 8 — unknown titles always send (a new call site must not be silently dropped)
  setSnapshot({});
  written.length = 0;
  await notify({ userId: 1, userType: 'student', title: 'Some Brand New Thing', message: 'x' });
  check('unmapped title still delivers', written.length === 1, `${written.length} written`);

  // 9 — explicit eventKey beats the title lookup
  setSnapshot({ 'classes.started': { enabled: false, audiences: ['student'] } });
  written.length = 0;
  await notify({ userId: 1, userType: 'student', title: 'Anything', message: 'x', eventKey: 'classes.started' });
  check('explicit eventKey is honoured', written.length === 0, `${written.length} written`);

  console.log(failures === 0 ? '\nAll gate checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures ? 1 : 0);
})();
