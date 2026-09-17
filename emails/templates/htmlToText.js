'use strict';

/**
 * Dependency-free HTML to plaintext conversion.
 *
 * Every message goes out multipart. Sending HTML-only materially hurts
 * deliverability — several filters treat a missing text/plain part as a spam
 * signal — and some recipients genuinely read the plaintext.
 *
 * This is deliberately not a general-purpose converter. It only has to handle
 * the markup that emails/templates/components.js produces.
 */

const ENTITY_MAP = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&zwnj;': '',
    '&#847;': '',
};

/**
 * @param {string} html
 * @returns {string}
 */
function htmlToText(html) {
    if (!html) return '';

    let out = String(html);

    // Drop anything that is not content.
    out = out.replace(/<!DOCTYPE[^>]*>/gi, '');
    out = out.replace(/<head[\s\S]*?<\/head>/gi, '');
    out = out.replace(/<style[\s\S]*?<\/style>/gi, '');
    out = out.replace(/<script[\s\S]*?<\/script>/gi, '');
    out = out.replace(/<!--[\s\S]*?-->/g, '');
    // The hidden preheader duplicates the first line of the body.
    out = out.replace(/<div style="display:none[\s\S]*?<\/div>/gi, '');

    // Links become "label (url)" so the destination survives.
    out = out.replace(
        /<a\b[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
        (_m, href, label) => {
            const text = label.replace(/<[^>]+>/g, '').trim();
            if (!href || href.startsWith('mailto:')) return text;
            return text && text !== href ? `${text} (${href})` : href;
        }
    );

    out = out.replace(/<li\b[^>]*>/gi, '\n  - ');
    out = out.replace(/<br\s*\/?>/gi, '\n');
    out = out.replace(/<\/(p|div|tr|h1|h2|h3|h4|ul|ol|table)>/gi, '\n');
    // Table cells on one row read better separated than concatenated.
    out = out.replace(/<\/(td|th)>/gi, '  ');

    out = out.replace(/<[^>]+>/g, '');

    for (const [entity, char] of Object.entries(ENTITY_MAP)) {
        out = out.split(entity).join(char);
    }
    out = out.replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)));

    // Tidy whitespace: trailing spaces, runs of blank lines, leading/trailing.
    out = out.replace(/[ \t]+\n/g, '\n');
    out = out.replace(/\n{3,}/g, '\n\n');
    out = out.replace(/[ \t]{2,}/g, ' ');

    return out.trim();
}

module.exports = { htmlToText };
