'use strict';

/**
 * Billing templates.
 *
 * Every one builds its markup with the `h` tagged literal — never a bare
 * backtick string — so a student name containing markup cannot reach an
 * admin's inbox as HTML. See ./escape.js.
 */

const { h } = require('./escape');
const { p, panel, infoRow, button, callout, muted } = require('./components');

/** Shared: "View your fees" CTA. */
const feesButton = (ctx, role = 'student') =>
    button('View your fees', `${ctx.appUrl}/${role}/fees`, ctx.primaryColor);

const feeRows = (fee, ctx) => [
    infoRow('Item', fee.title),
    infoRow('Amount', ctx.money(fee.amount)),
    infoRow('Due date', ctx.date(fee.dueDate)),
];

module.exports = {
    feeIssued: {
        subject: (d) => `New fee: ${d.fee.title}`,
        preheader: (d) => `${d.ctx.money(d.fee.amount)} due ${d.ctx.date(d.fee.dueDate)}.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${p(h`A new fee has been added to your account.`)}
${panel(feeRows(d.fee, d.ctx))}
${d.fee.notes ? p(h`Note: ${d.fee.notes}`) : ''}
${feesButton(d.ctx)}
${muted('Once you have paid, upload your payment proof so we can confirm it.')}`,
    },

    invoiceUploaded: {
        subject: (d) => `Invoice available — ${d.fee.title}`,
        preheader: () => 'Your invoice document is ready to download.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${p(h`The invoice for <strong>${d.fee.title}</strong> is now available in your account.`)}
${panel(feeRows(d.fee, d.ctx))}
${feesButton(d.ctx)}`,
    },

    feeOverdue: {
        subject: (d) => `Overdue: ${d.fee.title}`,
        preheader: (d) => `${d.ctx.money(d.fee.amount)} was due on ${d.ctx.date(d.fee.dueDate)}.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${callout(h`This payment is now past its due date.`, 'warning')}
${panel(feeRows(d.fee, d.ctx))}
${p('Please settle it as soon as you can, or upload your payment proof if you have already paid.')}
${feesButton(d.ctx)}`,
    },

    feeMarkedPaid: {
        subject: (d) => `Payment recorded — ${d.fee.title}`,
        preheader: (d) => `${d.ctx.money(d.fee.amount)} has been marked as paid.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${callout(h`Your payment for <strong>${d.fee.title}</strong> has been recorded. Thank you.`, 'success')}
${panel([
    infoRow('Item', d.fee.title),
    infoRow('Amount', d.ctx.money(d.fee.amount)),
    infoRow('Paid on', d.ctx.date(d.fee.paidDate)),
])}
${feesButton(d.ctx)}`,
    },

    proofSubmitted: {
        subject: (d) => `Payment proof to review — ${d.ctx.name(d.student)}`,
        preheader: (d) => `${d.fee.title}, ${d.ctx.money(d.fee.amount)} — awaiting verification.`,
        html: (d) => h`
${p(h`<strong>${d.ctx.name(d.student)}</strong> has uploaded payment proof for review.`)}
${panel([
    infoRow('Student', d.ctx.name(d.student)),
    infoRow('Item', d.fee.title),
    infoRow('Amount', d.ctx.money(d.fee.amount)),
    infoRow('Due date', d.ctx.date(d.fee.dueDate)),
])}
${button('Review payment proof', `${d.ctx.appUrl}/finance/fees`, d.ctx.primaryColor)}`,
    },

    proofVerified: {
        subject: (d) => `Payment confirmed — ${d.fee.title}`,
        preheader: (d) => `We have verified your payment of ${d.ctx.money(d.fee.amount)}.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${callout(h`Your payment for <strong>${d.fee.title}</strong> has been verified. Thank you.`, 'success')}
${panel([
    infoRow('Item', d.fee.title),
    infoRow('Amount', d.ctx.money(d.fee.amount)),
    infoRow('Paid on', d.ctx.date(d.fee.paidDate)),
])}
${feesButton(d.ctx)}`,
    },

    proofRejected: {
        subject: (d) => `Action needed: payment proof for ${d.fee.title}`,
        preheader: () => 'The proof you uploaded did not match our records.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${callout(h`We could not match the payment proof you uploaded for <strong>${d.fee.title}</strong>.`, 'danger')}
${d.fee.rejectionReason ? panel([infoRow('Reason', d.fee.rejectionReason)]) : ''}
${p('Please upload a corrected proof and we will review it again.')}
${button('Upload new proof', `${d.ctx.appUrl}/student/fees`, d.ctx.primaryColor)}`,
    },

    proofReminder: {
        subject: (d) => `Please share your payment proof — ${d.fee.title}`,
        preheader: (d) => `We have not yet received proof for ${d.ctx.money(d.fee.amount)}.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${p(h`We are still waiting on payment proof for <strong>${d.fee.title}</strong>.`)}
${panel(feeRows(d.fee, d.ctx))}
${button('Upload proof', `${d.ctx.appUrl}/student/fees`, d.ctx.primaryColor)}
${muted('If you have not paid yet, you can ignore this and pay when you are ready.')}`,
    },

    receipt: {
        subject: (d) => `Receipt for your payment — ${d.ctx.money(d.payment.amount)}`,
        preheader: (d) => `Received ${d.ctx.money(d.payment.amount)} on ${d.ctx.date(d.payment.paidOn)}.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${p('Thank you — here is your receipt.')}
${panel([
    infoRow('Receipt no.', `#${d.payment.id}`),
    infoRow('Amount', d.ctx.money(d.payment.amount)),
    infoRow('Method', d.payment.method || 'Not specified'),
    infoRow('Date', d.ctx.date(d.payment.paidOn)),
])}
${muted('Please keep this email for your records.')}`,
        // Hand-written: a receipt is the kind of email people forward and print,
        // so its plaintext part is worth getting right rather than generating.
        text: (d) => [
            `Hi ${d.ctx.name(d.student)},`,
            '',
            'Thank you - here is your receipt.',
            '',
            `Receipt no.: #${d.payment.id}`,
            `Amount:      ${d.ctx.money(d.payment.amount)}`,
            `Method:      ${d.payment.method || 'Not specified'}`,
            `Date:        ${d.ctx.date(d.payment.paidOn)}`,
            '',
            'Please keep this email for your records.',
        ].join('\n'),
    },

    cardAdded: {
        subject: () => 'A card was saved to your account',
        preheader: (d) => `Card ending ${d.method.last4 || '****'} is now on file.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${p(h`A card ending in <strong>${d.method.last4 || '••••'}</strong> has been saved for automatic fee payments.`)}
${callout('If you did not expect this, contact us immediately.', 'warning')}
${button('Manage payment methods', `${d.ctx.appUrl}/student/fees`, d.ctx.primaryColor)}`,
    },

    cardRemoved: {
        subject: () => 'Your saved card was removed',
        preheader: () => 'Fees will need to be paid manually from now on.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${p(h`The card ending in <strong>${d.method.last4 || '••••'}</strong> has been removed from your account.`)}
${p('Future fees will need to be paid manually, with payment proof uploaded for confirmation.')}
${callout('If you did not expect this, contact us immediately.', 'warning')}`,
    },

    autopayFailed: {
        subject: (d) => `We could not charge your card for ${d.fee.title}`,
        preheader: () => 'We will try again — no action needed unless it fails again.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${callout(h`We were unable to charge your saved card for <strong>${d.fee.title}</strong>.`, 'warning')}
${panel(feeRows(d.fee, d.ctx))}
${p('We will retry automatically. If it keeps failing we will let you know and you can pay manually.')}
${feesButton(d.ctx)}`,
    },

    autopayDeactivated: {
        subject: () => 'Auto-pay has been turned off',
        preheader: () => 'Repeated payment attempts failed, so your card was removed.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${callout('Auto-pay has been deactivated after several failed attempts, and your saved card has been removed.', 'danger')}
${p('Please pay any outstanding fees manually and upload your payment proof. You can add a new card at any time.')}
${feesButton(d.ctx)}`,
    },

    planChangeRequested: {
        subject: (d) => `Plan upgrade requested — ${d.ctx.name(d.student)}`,
        preheader: (d) => `Requested plan: ${d.requestedPlan ? d.requestedPlan.name : 'not specified'}.`,
        html: (d) => h`
${p(h`<strong>${d.ctx.name(d.student)}</strong> has requested a plan change.`)}
${panel([
    infoRow('Student', d.ctx.name(d.student)),
    infoRow('Requested plan', d.requestedPlan ? d.requestedPlan.name : 'Not specified'),
    infoRow('Price', d.requestedPlan ? d.ctx.money(d.requestedPlan.price) : '—'),
])}
${button('Review request', `${d.ctx.appUrl}/finance/fees`, d.ctx.primaryColor)}`,
    },

    planChangeApproved: {
        subject: (d) => `Plan upgrade approved — payment required`,
        preheader: (d) => `Pay ${d.fee ? d.ctx.money(d.fee.amount) : 'the upgrade fee'} to activate your new plan.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${callout(h`Your upgrade to <strong>${d.requestedPlan ? d.requestedPlan.name : 'the new plan'}</strong> has been approved.`, 'success')}
${p('Your new plan activates as soon as the upgrade fee is paid.')}
${d.fee ? panel(feeRows(d.fee, d.ctx)) : ''}
${feesButton(d.ctx)}`,
    },

    planChangeRejected: {
        subject: () => 'About your plan change request',
        preheader: () => 'Your requested plan change was not approved.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${p(h`Your request to change to <strong>${d.requestedPlan ? d.requestedPlan.name : 'a new plan'}</strong> was not approved, so your current plan stays as it is.`)}
${muted('If you would like to discuss this, just reply to this email.')}`,
    },

    planChangeCompleted: {
        subject: (d) => `Your new plan is active`,
        preheader: (d) => `${d.newPlan ? d.newPlan.name : 'Your new plan'} is now active.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${callout(h`Payment received — <strong>${d.newPlan ? d.newPlan.name : 'your new plan'}</strong> is now active.`, 'success')}
${button('View your plan', `${d.ctx.appUrl}/student/fees`, d.ctx.primaryColor)}`,
    },
};
