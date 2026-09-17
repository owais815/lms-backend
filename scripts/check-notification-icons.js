/**
 * Checks that every notification title the backend emits gets a meaningful icon
 * in the admin bell, rather than falling through to a generic severity icon.
 *
 * Usage:
 *   node scripts/check-notification-icons.js
 *   npm run check:icons
 *
 * Needs no database. It scrapes `title:` literals out of controllers/ and
 * Schedular/, pairs each with the priority it is emitted at, then runs the real
 * icon logic out of NotificationBell.tsx against each pair.
 *
 * The bell picks icons by substring-matching the title, so a new notification
 * whose wording misses every keyword renders as a plain bell (or a bare warning
 * triangle) and looks unfinished. Run this after adding or renaming a title.
 */

const fs = require('fs');
const path = require('path');

const BACKEND = path.join(__dirname, '..');
const BELL = path.join(
  BACKEND, '..', 'admin', 'src', 'components', 'common', 'NotificationBell.tsx'
);

// Titles that are a field value passed straight through (a session or quiz name),
// not a notification label. They cannot be checked statically.
const SKIP = new Set(['Notification']);

// Titles built with template literals — only the static prefix has to match.
const DYNAMIC_PREFIXES = [
  'Announcement: Example',
  'Plan Upgrade: Premium',
  'Plan Upgrade Approved: Premium',
];

// The per-severity fallbacks. Landing on one of these means no topic matched.
const FALLBACK_ICONS = new Set([
  'ti ti-bell',
  'ti ti-alert-triangle',
  'ti ti-alert-octagon',
]);

// ─── Pull the real icon logic out of the .tsx ────────────────────────────────

function loadIconForTitle() {
  if (!fs.existsSync(BELL)) {
    console.error('Could not find the bell component at:');
    console.error('  ' + BELL);
    process.exit(2);
  }

  const src = fs.readFileSync(BELL, 'utf8');

  // iconForTitle() delegates to topicIcon(), so both have to come across.
  const start = src.indexOf('const topicIcon');
  const iconStart = src.indexOf('const iconForTitle');
  if (start === -1 || iconStart === -1) {
    console.error('Could not locate topicIcon()/iconForTitle() in NotificationBell.tsx.');
    process.exit(2);
  }
  const tail = src.indexOf('\n};', iconStart);
  if (tail === -1) {
    console.error('Could not find the end of iconForTitle().');
    process.exit(2);
  }

  const block = src
    .slice(start, tail + 3)
    .replace('(t: string): string | null =>', '(t) =>')
    .replace('(title: string, priority: NotificationPriority): string =>', '(title, priority) =>');

  // eslint-disable-next-line no-eval
  return eval(block + '\niconForTitle;');
}

// ─── Scrape emitted titles with their priorities ─────────────────────────────

// Pairing title with priority matters: checking every title at all three
// priorities would flag a warning-only title like "Teacher No-Show" for an info
// variant that is never actually emitted.
function collectTitles() {
  const dirs = ['controllers', 'Schedular'].map((d) => path.join(BACKEND, d));
  const found = new Map();

  const add = (title, priority) => {
    if (!title || SKIP.has(title)) return;
    found.set(title + '|' + priority, { title, priority });
  };

  const TITLE_RE = /title:\s*(["'])([^"'\n]+?)\1/g;
  const PRIORITY_RE = /priority:\s*["']([a-z]+)["']/g;

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.js')) continue;
      const src = fs.readFileSync(path.join(dir, name), 'utf8');

      let m;
      TITLE_RE.lastIndex = 0;
      while ((m = TITLE_RE.exec(src)) !== null) {
        const title = m[2];
        if (title.includes('${')) continue; // interpolated — see DYNAMIC_PREFIXES

        // The sibling `priority:` sits in the same object literal, comfortably
        // inside the next few hundred characters.
        const window = src.slice(m.index, m.index + 400);
        const priorities = [...window.matchAll(PRIORITY_RE)].map((x) => x[1]);

        if (priorities.length === 0) {
          add(title, 'info'); // notify() defaults to info
        } else {
          // A ternary can produce two priorities for one title; record both.
          priorities.slice(0, 2).forEach((p) => add(title, p));
        }
      }
    }
  }
  return [...found.values()];
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const iconForTitle = loadIconForTitle();

const emitted = [
  ...collectTitles(),
  ...DYNAMIC_PREFIXES.map((title) => ({ title, priority: 'info' })),
];

const unmatched = emitted
  .map((e) => ({ ...e, icon: iconForTitle(e.title, e.priority) }))
  .filter((e) => FALLBACK_ICONS.has(e.icon));

console.log('Checked ' + emitted.length + ' title/priority combination(s).');

if (unmatched.length === 0) {
  console.log('PASS - every title resolves to a topic icon.');
  process.exit(0);
}

console.log('FAIL - ' + unmatched.length + ' fall back to a generic icon:');
unmatched.forEach((e) => {
  console.log('  ' + e.title + '  [' + e.priority + '] -> ' + e.icon);
});
console.log('');
console.log('Add a branch to topicIcon() in NotificationBell.tsx,');
console.log('or reword the title so it contains an existing keyword.');
process.exit(1);
