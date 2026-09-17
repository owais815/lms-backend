'use strict';

/**
 * The XSS boundary for every email this system sends.
 *
 * Templates are plain JS template literals — no handlebars, no mjml, no build
 * step. The single thing that approach lacks is auto-escaping, and this file
 * supplies it in a dozen lines.
 *
 * RULE: every template builds its HTML with the `h` tagged literal, never a
 * bare backtick string. A student whose firstName is "<script>" must not be
 * able to reach an admin's inbox with it. Components return raw() so their
 * already-escaped markup passes through untouched.
 */

const ENTITIES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

/**
 * Escape a single value for HTML output. Null and undefined become ''.
 * @param {*} v
 * @returns {string}
 */
const esc = (v) => String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, (c) => ENTITIES[c]);

/**
 * Mark a pre-rendered fragment as safe so `h` will not escape it again.
 * @param {string} s
 */
const raw = (s) => Object.assign(new String(s), { __safe: true });

/**
 * Tagged template literal that escapes every interpolated value.
 *
 * The literal parts are trusted markup the developer typed; only the
 * interpolations are escaped.
 *
 * Returns a raw()-marked value, because the result is by definition already
 * escaped. Without that, nesting — which every template does, e.g.
 * `p(h`...<strong>${x}</strong>...`)` — would escape the developer's own markup
 * a second time and render literal "&lt;strong&gt;" in the inbox.
 *
 * @example
 *   h`<p>Hi ${student.firstName}</p>${button('Pay now', url)}`
 */
const h = (strings, ...vals) =>
    raw(strings.reduce((out, s, i) => {
        if (i >= vals.length) return out + s;
        const v = vals[i];
        if (v && v.__safe) return out + s + v.toString();
        // Arrays of components are common (table rows, list items).
        if (Array.isArray(v)) {
            return out + s + v.map((item) => (item && item.__safe ? item.toString() : esc(item))).join('');
        }
        return out + s + esc(v);
    }, ''));

/**
 * Escape a value for use inside an HTML attribute that is already quoted with
 * double quotes. Same rules — kept separate so intent is readable at call sites.
 */
const attr = esc;

module.exports = { esc, raw, h, attr };
