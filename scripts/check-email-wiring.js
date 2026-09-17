'use strict';

/**
 * Cross-checks every wired call site against the registry.
 *
 * A typo'd event key degrades to a console warning at runtime rather than an
 * error, which is the right call for resilience but means a mistake could sit
 * unnoticed for months. This turns that silence into a build failure.
 *
 * Run with: npm run email:check
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const registry = require('../emails/registry');

const ROOT = path.join(__dirname, '..');
const DIRS = ['controllers', 'Schedular', 'utils', 'routes'];

/** Only files that actually dispatch are worth scanning. */
const USES_DISPATCH = /sendEmailEvent|emailEvent:/;

/**
 * Broad: any quoted string shaped like an event key.
 *
 * Deliberately not anchored on the call itself, because several sites pick
 * their key with a ternary —
 *   sendEmailEvent(salary.status === 'paid' ? 'salary.paid' : 'salary.generated', …)
 * — and an anchored pattern would report those as unwired. Matches are
 * validated against the registry, so unrelated dotted strings are ignored.
 */
const KEY_LIKE = /['"]([a-z_]+\.[a-z0-9_]{3,})['"]/g;

/** Narrow: a key handed straight to the dispatcher. These must be real. */
const DIRECT_KEY = /(?:sendEmailEvent\(\s*|emailEvent:\s*)['"]([^'"]+)['"]/g;

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

const used = new Map();
const unknown = [];

function eachSourceFile(fn) {
    for (const dir of DIRS) {
        const full = path.join(ROOT, dir);
        if (!fs.existsSync(full)) continue;
        for (const file of fs.readdirSync(full)) {
            if (!file.endsWith('.js')) continue;
            const src = fs.readFileSync(path.join(full, file), 'utf8');
            if (!USES_DISPATCH.test(src)) continue;
            fn(`${dir}/${file}`, src);
        }
    }
}

// Pass 1 — which registry events are referenced, and from where.
eachSourceFile((rel, src) => {
    KEY_LIKE.lastIndex = 0;
    let m;
    while ((m = KEY_LIKE.exec(src)) !== null) {
        const key = m[1];
        if (!registry.getEvent(key)) continue;
        if (!used.has(key)) used.set(key, []);
        used.get(key).push(`${rel}:${lineOf(src, m.index)}`);
    }
});

// Pass 2 — keys passed directly to the dispatcher that do not exist. Typos.
eachSourceFile((rel, src) => {
    DIRECT_KEY.lastIndex = 0;
    let m;
    while ((m = DIRECT_KEY.exec(src)) !== null) {
        if (m[1] === 'undefined') continue; // conditional dispatch
        if (!registry.getEvent(m[1])) {
            unknown.push({ key: m[1], where: `${rel}:${lineOf(src, m.index)}` });
        }
    }
});

const totalSites = [...used.values()].reduce((n, v) => n + v.length, 0);
console.log(`\nWired call sites:      ${totalSites}`);
console.log(`Distinct events wired: ${used.size} of ${registry.ALL.length}`);

if (unknown.length) {
    console.error(`\n${unknown.length} call site(s) reference an event that does not exist:\n`);
    for (const u of unknown) console.error(`  ${u.where}  ->  "${u.key}"`);
    process.exit(1);
}

// Not a failure. Reminders and digests are fired by their own crons, and some
// events are reserved for flows this codebase does not have yet (there is no
// password-reset endpoint, for instance).
const CRON_FIRED = ['reminders', 'digests'];
const unwired = registry.ALL.filter(
    (e) => !used.has(e.key) && !CRON_FIRED.includes(e.category)
);

if (unwired.length) {
    console.log(`\n${unwired.length} registry event(s) have no call site yet:`);
    for (const e of unwired) console.log(`  ${e.key.padEnd(38)} ${e.label}`);
}

console.log('');
process.exit(0);
