/**
 * Checks that every notification the backend emits is claimed by a registry
 * event, so it can actually be toggled from the admin settings page.
 *
 * Usage:
 *   node scripts/check-notification-events.js
 *   npm run check:events
 *
 * Needs no database.
 *
 * A title that no event claims still delivers — notify() fails open on purpose,
 * because a new call site must not be silently dropped just because its registry
 * entry has not landed yet. But it is invisible in the settings UI and cannot be
 * switched off, so it should be treated as unfinished. Run this after adding or
 * rewording a notification.
 */

const fs = require('fs');
const path = require('path');

const BACKEND = path.join(__dirname, '..');
const registry = require('../notifications/registry');

// `title:` is not unique to notifications — calendar events and Fee rows carry
// one too. These are the known non-notification title sites; each is a real
// object field that happens to share the property name.
const NOT_NOTIFICATIONS = new Set([
    'Quiz',            // classSchedule.js — FullCalendar event for a quiz
    'Assignment',      // classSchedule.js — FullCalendar event for an assignment
    'Plan Upgrade',    // planchangerequest.js — the Fee title, not a notification
    'Notification',    // the legacy default title
]);

// A `title:` value is not always a bare literal. Ternaries put the branches on
// their own lines, and template literals carry a static prefix the bell matches
// on. Missing either would report a live notification as unclaimed.
const LOOKAHEAD_LINES = 3;

function collectTitles() {
    const dirs = ['controllers', 'Schedular', 'middleware'].map((d) => path.join(BACKEND, d));
    const found = new Map(); // title -> Set of "file:line"

    const TITLE_RE = /title:/g;
    const LITERAL_RE = /(["'`])((?:(?!\1).)*?)\1/g;

    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        for (const name of fs.readdirSync(dir)) {
            if (!name.endsWith('.js')) continue;
            const rel = path.join(path.basename(dir), name);
            const src = fs.readFileSync(path.join(dir, name), 'utf8');
            const lines = src.split('\n');

            let m;
            TITLE_RE.lastIndex = 0;
            while ((m = TITLE_RE.exec(src)) !== null) {
                const lineNo = src.slice(0, m.index).split('\n').length;

                // Take this line from `title:` onward, plus the next couple, so a
                // multi-line ternary contributes all of its branches. Stop at the
                // first line that starts a new property, to avoid bleeding into
                // `message:` and harvesting its literals.
                const firstLine = lines[lineNo - 1].slice(
                    lines[lineNo - 1].indexOf('title:') + 'title:'.length
                );
                const chunk = [firstLine];
                for (let i = lineNo; i < Math.min(lineNo + LOOKAHEAD_LINES, lines.length); i++) {
                    const next = lines[i];
                    if (/^\s*(message|parentMessage|teacherMessage|priority|userId|userType|eventKey|start|end|amount|dueDate)\s*:/.test(next)) break;
                    if (/^\s*[}\])]/.test(next)) break;
                    chunk.push(next);
                }

                let lit;
                const blob = chunk.join('\n');
                LITERAL_RE.lastIndex = 0;
                while ((lit = LITERAL_RE.exec(blob)) !== null) {
                    let title = lit[2];

                    const interp = title.indexOf('${');
                    if (interp !== -1) title = title.slice(0, interp);
                    title = title.replace(/[:\s-]+$/, '').trim();

                    if (!title || title.length < 3) continue;
                    if (NOT_NOTIFICATIONS.has(title)) continue;
                    // A comparison operand, not a title: `status === 'paid' ? ...`
                    if (!/[A-Z]/.test(title)) continue;

                    if (!found.has(title)) found.set(title, new Set());
                    found.get(title).add(`${rel}:${lineNo}`);
                }
            }
        }
    }
    return found;
}

const emitted = collectTitles();

const unclaimed = [];
for (const [title, sites] of emitted) {
    if (!registry.getEventKeyForTitle(title)) {
        unclaimed.push({ title, sites: [...sites] });
    }
}

// The reverse problem: an event declares a title nothing emits any more. Not a
// failure — a registry entry can legitimately land before its call site — but
// worth surfacing so dead entries do not accumulate in the settings UI.
const emittedLower = new Set([...emitted.keys()].map((t) => t.toLowerCase()));
const stale = [];
for (const evt of registry.ALL) {
    for (const title of evt.titles) {
        const t = title.toLowerCase();
        const matched = emittedLower.has(t) || [...emittedLower].some((e) => e.startsWith(t));
        if (!matched) stale.push({ key: evt.key, title });
    }
}

console.log(
    `${emitted.size} distinct title(s) emitted, ${registry.ALL.length} registry event(s).`
);

if (stale.length > 0) {
    console.log('');
    console.log(`NOTE - ${stale.length} registry title(s) are not emitted anywhere:`);
    stale.forEach((s) => console.log(`  ${s.key}  ->  "${s.title}"`));
}

if (unclaimed.length === 0) {
    console.log('');
    console.log('PASS - every emitted title maps to a toggleable event.');
    process.exit(0);
}

console.log('');
console.log(`FAIL - ${unclaimed.length} title(s) belong to no registry event:`);
unclaimed.forEach((u) => {
    console.log(`  "${u.title}"`);
    u.sites.forEach((site) => console.log(`      ${site}`));
});
console.log('');
console.log('Add the title to an event in notifications/registry/events.js,');
console.log('or define a new event for it. Until then it cannot be switched off.');
process.exit(1);
