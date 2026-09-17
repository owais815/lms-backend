const AutoPayMethod = require('../models/AutoPayMethod');
const Student = require('../models/Student');
const notify = require('../utils/notify');
const notifyAdmins = require('../utils/notifyAdmins');
const { sendEmailEvent } = require('../emails');
const { notifyStudentAndParent, displayName } = require('../utils/notifyAudience');

// GET /api/auto-pay/student/:studentId — current card-on-file, if any
exports.getCardOnFile = async (req, res) => {
    try {
        const method = await AutoPayMethod.findOne({
            where: { studentId: req.params.studentId, status: 'active' },
        });
        res.json({ method });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/auto-pay/student/:studentId — register a card on file
// NOTE: this only stores a reference — no real payment gateway (Stripe etc.)
// is integrated yet. See attemptCharge() below.
exports.addCardOnFile = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { last4, tokenRef } = req.body;

        await AutoPayMethod.update(
            { status: 'removed' },
            { where: { studentId, status: 'active' } }
        );
        const method = await AutoPayMethod.create({
            studentId,
            last4: last4 || null,
            tokenRef: tokenRef || null,
            status: 'active',
        });

        await notify({
            userId: studentId,
            userType: 'student',
            title: 'Card on File Added',
            message: `A card ending in ${last4 || '····'} has been saved for automatic fee payments.`,
        });
        // The parent is in this event's audience even though the in-app
        // notification above reaches only the student: a card attached to a
        // child's account is something a parent must always hear about.
        sendEmailEvent('autopay.card_added', { method, studentId });

        res.status(201).json({ method });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE /api/auto-pay/:id — remove a card on file
exports.removeCardOnFile = async (req, res) => {
    try {
        const method = await AutoPayMethod.findByPk(req.params.id);
        if (!method) return res.status(404).json({ message: 'Auto-pay method not found' });

        method.status = 'removed';
        await method.save();

        await notify({
            userId: method.studentId,
            userType: 'student',
            title: 'Card Removed',
            message: 'Your card on file was removed. You\'ll need to pay fees manually and share proof going forward.',
        });
        sendEmailEvent('autopay.card_removed', { method, studentId: method.studentId });

        res.json({ method });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Stub charge attempt — deliberately does not move real money.
// Replace this with a real gateway call (e.g. Stripe PaymentIntent) before
// relying on it for anything beyond exercising the notification flow.
exports.attemptCharge = async (fee, method) => {
    return { ok: false, reason: 'no_processor_configured' };
};

// Deactivates a repeatedly-failing auto-pay method and notifies everyone.
exports.deactivateAutoPay = async (method) => {
    method.status = 'removed';
    await method.save();

    const student = await Student.findByPk(method.studentId, { attributes: ['id', 'firstName', 'lastName', 'parentId'] });
    const msg = 'Auto-pay was deactivated after repeated failed attempts — please pay your fees manually.';
    if (student) {
        await notifyStudentAndParent({
            studentId: student.id,
            title: 'Auto-Pay Deactivated',
            message: msg,
            priority: 'warning',
            emailEvent: 'autopay.deactivated',
            emailContext: { method, student },
        });
    }
    await notifyAdmins({
        title: 'Auto-Pay Deactivated',
        message: `Auto-pay for ${displayName(student, `student #${method.studentId}`)} was deactivated after repeated failures.`,
        priority: 'warning',
    });
};
