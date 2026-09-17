'use strict';

/**
 * Renders every registry event against its own samplePayload.
 *
 * Run with: npm run email:verify
 *
 * This is the guard that stops eighty-nine templates rotting silently. A typo'd
 * field, a renamed payload key or a missing template fails here rather than at
 * send time, months later, in front of a parent.
 */

require('dotenv').config();

const registry = require('../emails/registry');
const { render } = require('../emails/templates');
const { buildDefaults } = require('../emails/settings/defaults');

const globals = buildDefaults();
const failures = [];
let ok = 0;

for (const evt of registry.ALL) {
    try {
        const out = render({
            templateName: evt.template,
            category: evt.category,
            data: evt.samplePayload,
            globals,
            recipient: {},
        });

        if (!out.subject || !out.subject.trim()) throw new Error('empty subject');
        if (!out.html.includes('<!DOCTYPE')) throw new Error('layout not applied');
        if (!out.text || out.text.trim().length < 10) throw new Error('empty plaintext part');
        // A literal "undefined" in output means a payload key was renamed and
        // the template was not updated with it.
        if (/\bundefined\b/.test(out.subject)) throw new Error(`"undefined" in subject: ${out.subject}`);

        ok += 1;
    } catch (err) {
        failures.push({ key: evt.key, template: evt.template, error: err.message });
    }
}

console.log(`\nRendered ${ok}/${registry.ALL.length} email templates successfully.`);

if (failures.length) {
    console.error(`\n${failures.length} template(s) failed:\n`);
    for (const f of failures) {
        console.error(`  ${f.key}  (${f.template})\n    ${f.error}`);
    }
    process.exit(1);
}

// Coverage summary, so it is obvious at a glance which categories exist.
for (const group of registry.grouped()) {
    const enabled = group.events.filter((e) => e.defaultEnabled).length;
    console.log(`  ${group.category.padEnd(12)} ${String(group.events.length).padStart(3)} events  (${enabled} on by default)`);
}

console.log('');
process.exit(0);
