'use strict';

/**
 * The only file in the subsystem that contains raw styling.
 *
 * Every visual decision lives here so that rebranding, or fixing a rendering
 * bug in Outlook, touches one file rather than ninety templates.
 *
 * Email HTML constraints this file respects:
 *  - inline styles only (Gmail strips <style> blocks inconsistently)
 *  - tables for layout (Outlook's rendering engine is Word)
 *  - no flexbox, no grid, no custom properties, no external CSS
 */

const { h, raw, esc } = require('./escape');

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const TEXT = '#2f3542';
const MUTED_TEXT = '#6b7280';
const BORDER = '#e5e7eb';
const PANEL_BG = '#f8f9fb';

/** Section heading. */
const heading = (text) =>
    raw(h`<h2 style="margin:0 0 12px;font-family:${raw(FONT)};font-size:18px;font-weight:600;color:${raw(TEXT)};">${text}</h2>`);

/** Body paragraph. */
const p = (content) =>
    raw(h`<p style="margin:0 0 14px;font-family:${raw(FONT)};font-size:15px;line-height:1.55;color:${raw(TEXT)};">${content}</p>`);

/** Smaller, greyed-out text for caveats and fine print. */
const muted = (content) =>
    raw(h`<p style="margin:0 0 12px;font-family:${raw(FONT)};font-size:13px;line-height:1.5;color:${raw(MUTED_TEXT)};">${content}</p>`);

/** Horizontal rule. */
const divider = () =>
    raw(`<div style="height:1px;background:${BORDER};margin:20px 0;line-height:1px;font-size:0;">&nbsp;</div>`);

/**
 * Primary call-to-action. Table-wrapped so Outlook renders the background.
 * @param {string} label
 * @param {string} url
 * @param {string} [color] hex, from branding
 */
const button = (label, url, color = '#2E37A4') =>
    raw(h`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
  <tr><td align="center" bgcolor="${color}" style="border-radius:6px;">
    <a href="${url}" style="display:inline-block;padding:11px 24px;font-family:${raw(FONT)};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${label}</a>
  </td></tr>
</table>`);

/**
 * A label/value row inside a panel.
 * @param {string} label
 * @param {string} value
 */
const infoRow = (label, value) =>
    raw(h`<tr>
  <td style="padding:7px 0;font-family:${raw(FONT)};font-size:14px;color:${raw(MUTED_TEXT)};width:42%;vertical-align:top;">${label}</td>
  <td style="padding:7px 0;font-family:${raw(FONT)};font-size:14px;color:${raw(TEXT)};font-weight:600;vertical-align:top;">${value}</td>
</tr>`);

/**
 * Grey panel wrapping a set of infoRow()s.
 * @param {Array} rows
 */
const panel = (rows) =>
    raw(h`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${raw(PANEL_BG)};border:1px solid ${raw(BORDER)};border-radius:8px;padding:14px 18px;margin:0 0 18px;">
  ${rows}
</table>`);

/**
 * Coloured callout for warnings and confirmations.
 * @param {string} content
 * @param {'info'|'success'|'warning'|'danger'} [tone]
 */
const callout = (content, tone = 'info') => {
    const tones = {
        info:    { bg: '#eef2ff', border: '#c7d2fe', text: '#3730a3' },
        success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
        warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
        danger:  { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
    };
    const t = tones[tone] || tones.info;
    return raw(h`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${raw(t.bg)};border:1px solid ${raw(t.border)};border-radius:8px;margin:0 0 18px;">
  <tr><td style="padding:13px 16px;font-family:${raw(FONT)};font-size:14px;line-height:1.5;color:${raw(t.text)};">${content}</td></tr>
</table>`);
};

/**
 * Simple data table.
 * @param {string[]} headers
 * @param {Array<Array<string>>} rows
 */
const table = (headers, rows) => {
    const head = headers
        .map((label) => h`<th align="left" style="padding:8px 10px;font-family:${raw(FONT)};font-size:13px;font-weight:600;color:${raw(MUTED_TEXT)};border-bottom:2px solid ${raw(BORDER)};">${label}</th>`)
        .join('');
    const body = rows
        .map((cells) => {
            const tds = cells
                .map((c) => h`<td style="padding:8px 10px;font-family:${raw(FONT)};font-size:14px;color:${raw(TEXT)};border-bottom:1px solid ${raw(BORDER)};">${c}</td>`)
                .join('');
            return `<tr>${tds}</tr>`;
        })
        .join('');
    return raw(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 18px;">
  <thead><tr>${head}</tr></thead>
  <tbody>${body}</tbody>
</table>`);
};

/**
 * Bulleted list.
 * @param {string[]} items
 */
const list = (items) =>
    raw(`<ul style="margin:0 0 16px;padding-left:20px;font-family:${FONT};font-size:15px;line-height:1.6;color:${TEXT};">${
        items.map((i) => `<li style="margin:0 0 6px;">${i && i.__safe ? i.toString() : esc(i)}</li>`).join('')
    }</ul>`);

/** Monospace block, for credentials and reference codes. */
const code = (text) =>
    raw(h`<div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:16px;font-weight:600;letter-spacing:0.5px;background:${raw(PANEL_BG)};border:1px solid ${raw(BORDER)};border-radius:6px;padding:12px 16px;margin:0 0 16px;color:${raw(TEXT)};word-break:break-all;">${text}</div>`);

module.exports = {
    heading, p, muted, divider, button, infoRow, panel, callout, table, list, code,
    FONT, TEXT, MUTED_TEXT, BORDER, PANEL_BG,
};
