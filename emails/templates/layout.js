'use strict';

/**
 * The branded HTML shell every email is rendered into.
 *
 * Branding is passed in from the settings snapshot rather than read globally,
 * which keeps a rendered email a pure function of (template, data, settings).
 * That is what makes the admin "preview this log row" feature possible: the
 * same inputs always produce the same output, months later.
 */

const { h, raw } = require('./escape');
const { FONT, TEXT, MUTED_TEXT, BORDER } = require('./components');

/**
 * @param {Object} opts
 * @param {string} opts.subject
 * @param {string} opts.preheader  Inbox preview line — hidden in the body
 * @param {string} opts.bodyHtml   Already-escaped markup from a template
 * @param {Object} opts.branding   { brandName, logoUrl, primaryColor }
 * @param {Object} opts.footer     { address, supportEmail, note }
 * @param {string} opts.categoryLabel  Powers the "why am I getting this" line
 * @returns {string} full HTML document
 */
function renderLayout({ subject, preheader, bodyHtml, branding = {}, footer = {}, categoryLabel = '' }) {
    const brandName = branding.brandName || 'LMS';
    const primary = branding.primaryColor || '#2E37A4';
    const logoUrl = branding.logoUrl || '';

    const header = logoUrl
        ? h`<img src="${logoUrl}" alt="${brandName}" width="140" style="display:block;border:0;max-width:140px;height:auto;" />`
        : h`<span style="font-family:${raw(FONT)};font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">${brandName}</span>`;

    const footerBits = [];
    if (categoryLabel) {
        footerBits.push(h`You are receiving this because you have ${categoryLabel} notifications enabled for your ${brandName} account.`);
    }
    if (footer.supportEmail) {
        footerBits.push(h`Questions? Reach us at <a href="mailto:${footer.supportEmail}" style="color:${raw(primary)};text-decoration:none;">${footer.supportEmail}</a>.`);
    }
    if (footer.address) footerBits.push(h`${footer.address}`);
    if (footer.note) footerBits.push(h`${footer.note}`);

    const footerHtml = footerBits
        .map((bit) => `<p style="margin:0 0 7px;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED_TEXT};">${bit}</p>`)
        .join('');

    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<title>${require('./escape').esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f3f7;-webkit-text-size-adjust:100%;">
<!-- Inbox preview text, then whitespace so the client does not pull body copy in after it -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${require('./escape').esc(preheader || '')}</div>
<div style="display:none;max-height:0;overflow:hidden;">${'&#847;&zwnj;&nbsp;'.repeat(30)}</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f3f7;">
  <tr>
    <td align="center" style="padding:28px 16px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid ${BORDER};">

        <tr>
          <td align="left" bgcolor="${primary}" style="padding:20px 28px;background:${primary};">
            ${header}
          </td>
        </tr>

        <tr>
          <td style="padding:28px;font-family:${FONT};font-size:15px;line-height:1.55;color:${TEXT};">
            ${bodyHtml}
          </td>
        </tr>

      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;">
        <tr>
          <td style="padding:18px 28px 0;text-align:center;">
            ${footerHtml}
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}

module.exports = { renderLayout };
