'use strict';

const { defineEvent } = require('./schema');

/**
 * Money events. Priority 2 throughout — these go out ahead of normal traffic
 * but behind credentials and password resets.
 *
 * Anchor sites: controllers/fees.js, payment.js, autoPay.js,
 * planchangerequest.js, Schedular/markOverdueFees.js, autoChargeFees.js
 */

const sampleFee = {
    id: 42,
    title: 'March Tuition',
    amount: '4500.00',
    dueDate: '2026-03-15',
    paidDate: null,
    status: 'pending',
};
const sampleStudent = { id: 7, firstName: 'Ayesha', lastName: 'Khan' };

module.exports = [
    defineEvent({
        key: 'fee.issued',
        category: 'payments',
        label: 'New fee issued',
        description: 'Sent to the student and parent when an admin creates a new fee or invoice.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'payments/feeIssued',
        entityType: 'fee',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: { fee: sampleFee, student: sampleStudent },
    }),

    defineEvent({
        key: 'fee.invoice_uploaded',
        category: 'payments',
        label: 'Invoice document uploaded',
        description: 'Sent when an admin attaches an official invoice PDF to an existing fee.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'payments/invoiceUploaded',
        entityType: 'fee',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: { fee: sampleFee, student: sampleStudent },
    }),

    defineEvent({
        key: 'fee.overdue',
        category: 'payments',
        label: 'Fee overdue',
        description: 'Sent when a fee passes its due date unpaid, and at most once a day thereafter.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'payments/feeOverdue',
        entityType: 'fee',
        dedupScope: 'entity+day',
        priority: 2,
        samplePayload: { fee: { ...sampleFee, status: 'overdue' }, student: sampleStudent },
    }),

    defineEvent({
        key: 'fee.marked_paid',
        category: 'payments',
        label: 'Fee marked paid by admin',
        description: 'Sent when an admin marks a fee paid directly, without a proof-verification step.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'payments/feeMarkedPaid',
        entityType: 'fee',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: {
            fee: { ...sampleFee, status: 'paid', paidDate: '2026-03-14' },
            student: sampleStudent,
        },
    }),

    defineEvent({
        key: 'payment.proof_submitted',
        category: 'payments',
        label: 'Payment proof submitted',
        description: 'Alerts admins that a student has uploaded payment proof awaiting review.',
        defaultEnabled: true,
        audiences: ['admin'],
        template: 'payments/proofSubmitted',
        entityType: 'fee',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: { fee: sampleFee, student: sampleStudent },
    }),

    defineEvent({
        key: 'payment.proof_verified',
        category: 'payments',
        label: 'Payment proof verified',
        description: 'Sent to the student and parent when an admin approves a submitted payment proof.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'payments/proofVerified',
        entityType: 'fee',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: {
            fee: { ...sampleFee, status: 'paid', paidDate: '2026-03-14' },
            student: sampleStudent,
        },
    }),

    defineEvent({
        key: 'payment.proof_rejected',
        category: 'payments',
        label: 'Payment proof rejected',
        description: 'Sent when submitted proof does not match, asking for a resubmission.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'payments/proofRejected',
        entityType: 'fee',
        // A rejection can legitimately recur for the same fee as proof is
        // resubmitted, so dedup by day rather than once-ever.
        dedupScope: 'entity+day',
        priority: 2,
        samplePayload: {
            fee: { ...sampleFee, proofStatus: 'rejected', rejectionReason: 'Amount does not match' },
            student: sampleStudent,
        },
    }),

    defineEvent({
        key: 'payment.proof_reminder',
        category: 'payments',
        label: 'Payment proof reminder',
        description: 'Manual nudge from an admin asking a student to share their payment proof.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'payments/proofReminder',
        entityType: 'fee',
        dedupScope: 'entity+day',
        priority: 2,
        samplePayload: { fee: sampleFee, student: sampleStudent },
    }),

    defineEvent({
        key: 'payment.receipt_issued',
        category: 'payments',
        label: 'Payment receipt',
        description: 'Receipt sent when a payment is recorded against a student account.',
        // Transactional: a receipt is a financial record the payer is entitled
        // to, so it is not an admin preference.
        transactional: true,
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'payments/receipt',
        entityType: 'payment',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: {
            payment: { id: 900, amount: '4500.00', method: 'Bank transfer', paidOn: '2026-03-14' },
            student: sampleStudent,
        },
    }),

    defineEvent({
        key: 'autopay.card_added',
        category: 'payments',
        label: 'Card on file added',
        description: 'Confirms a card was saved for automatic fee payments. Also goes to the parent.',
        // Security-adjacent: a card being attached to a child's account is
        // something a parent must always hear about, so it is not optional.
        transactional: true,
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'payments/cardAdded',
        entityType: 'autopay',
        dedupScope: 'entity',
        priority: 1,
        samplePayload: { method: { id: 3, last4: '4242' }, student: sampleStudent },
    }),

    defineEvent({
        key: 'autopay.card_removed',
        category: 'payments',
        label: 'Card on file removed',
        description: 'Confirms a saved card was removed and fees must now be paid manually.',
        transactional: true,
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'payments/cardRemoved',
        entityType: 'autopay',
        dedupScope: 'entity',
        priority: 1,
        samplePayload: { method: { id: 3, last4: '4242' }, student: sampleStudent },
    }),

    defineEvent({
        key: 'autopay.charge_failed',
        category: 'payments',
        label: 'Auto-pay charge failed',
        description: 'Sent when a scheduled card charge fails and will be retried.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'payments/autopayFailed',
        entityType: 'fee',
        dedupScope: 'entity+day',
        priority: 2,
        samplePayload: { fee: sampleFee, student: sampleStudent },
    }),

    defineEvent({
        key: 'autopay.deactivated',
        category: 'payments',
        label: 'Auto-pay deactivated',
        description: 'Sent to the family and admins when a card is dropped after repeated failures.',
        defaultEnabled: true,
        audiences: ['student', 'parent', 'admin'],
        template: 'payments/autopayDeactivated',
        entityType: 'autopay',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: { method: { id: 3, last4: '4242' }, student: sampleStudent },
    }),

    defineEvent({
        key: 'plan_change.requested',
        category: 'payments',
        label: 'Plan change requested',
        description: 'Alerts admins that a student has requested a plan upgrade.',
        defaultEnabled: true,
        audiences: ['admin'],
        template: 'payments/planChangeRequested',
        entityType: 'plan_change',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: {
            request: { id: 11 },
            requestedPlan: { name: 'Premium', price: '9000.00' },
            student: sampleStudent,
        },
    }),

    defineEvent({
        key: 'plan_change.approved',
        category: 'payments',
        label: 'Plan change approved — payment due',
        description: 'Tells the family their upgrade was approved and activates once the fee is paid.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'payments/planChangeApproved',
        entityType: 'plan_change',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: {
            request: { id: 11 },
            requestedPlan: { name: 'Premium', price: '9000.00' },
            fee: { ...sampleFee, title: 'Plan Upgrade: Premium' },
            student: sampleStudent,
        },
    }),

    defineEvent({
        key: 'plan_change.rejected',
        category: 'payments',
        label: 'Plan change rejected',
        description: 'Tells the family their plan change request was not approved.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'payments/planChangeRejected',
        entityType: 'plan_change',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: {
            request: { id: 11 },
            requestedPlan: { name: 'Premium' },
            student: sampleStudent,
        },
    }),

    defineEvent({
        key: 'plan_change.completed',
        category: 'payments',
        label: 'Plan change completed',
        description: 'Confirms the new plan is active after the upgrade fee was paid.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'payments/planChangeCompleted',
        entityType: 'plan_change',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: {
            request: { id: 11 },
            newPlan: { name: 'Premium' },
            student: sampleStudent,
        },
    }),
];
