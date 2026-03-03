
const Plan = require('../models/Plan');
const PlanChangeRequest = require('../models/PlanChangeRequest');
const Student = require('../models/Student');
const Fee = require('../models/Fee');

// ── Student: Submit a plan change request ────────────────────────────────────

exports.requestPlanChange = async (req, res) => {
    const { studentId, requestedPlanId } = req.body;

    try {
        const student = await Student.findByPk(studentId, { include: 'Plan' });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        // Block if a pending or approved (fee created) request already exists
        const existingRequest = await PlanChangeRequest.findOne({
            where: { studentId, status: ['pending', 'approved'] },
        });
        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: 'You already have an active plan change request.',
            });
        }

        const request = await PlanChangeRequest.create({
            studentId,
            currentPlanId: student.planId,
            requestedPlanId,
        });

        res.status(201).json({ success: true, message: 'Plan change request submitted.', request });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ── Admin: Get all plan change requests ──────────────────────────────────────

exports.getAllPlanChangeRequests = async (req, res) => {
    try {
        const requests = await PlanChangeRequest.findAll({
            include: [
                { model: Student, attributes: ['id', 'firstName', 'lastName', 'username'] },
                { model: Plan, as: 'CurrentPlan', attributes: ['name', 'price'] },
                { model: Plan, as: 'RequestedPlan', attributes: ['name', 'price'] },
                {
                    model: Fee, as: 'paymentFee',
                    attributes: ['id', 'status', 'amount', 'dueDate', 'paidDate'],
                },
            ],
            order: [['createdAt', 'DESC']],
        });

        res.status(200).json({ success: true, requests });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ── Admin: Approve — creates a Fee, does NOT update planId yet ───────────────

exports.approvePlanChangeRequest = async (req, res) => {
    const { requestId } = req.params;
    try {
        const request = await PlanChangeRequest.findByPk(requestId);
        if (!request || request.status !== 'pending') {
            return res.status(404).json({ error: 'Request not found or already processed' });
        }

        // Fetch the requested plan to get its price
        const requestedPlan = await Plan.findByPk(request.requestedPlanId);
        if (!requestedPlan) {
            return res.status(404).json({ error: 'Requested plan not found' });
        }

        // Due date: 7 days from today
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);

        // Auto-create a Fee for this plan change — student must pay before plan is updated
        await Fee.create({
            studentId: request.studentId,
            planId: request.requestedPlanId,
            planChangeRequestId: request.id,
            title: `Plan Upgrade: ${requestedPlan.name}`,
            amount: requestedPlan.price,
            dueDate: dueDate.toISOString().split('T')[0],
            notes: `Auto-generated for plan change request #${request.id}`,
        });

        // Mark request as approved — plan is NOT updated until fee is paid
        request.status = 'approved';
        await request.save();

        res.json({ success: true, message: 'Plan change approved. Fee created — plan will update once payment is confirmed.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while approving the request.' });
    }
};

// ── Admin: Reject ─────────────────────────────────────────────────────────────

exports.rejectPlanChangeRequest = async (req, res) => {
    const { requestId } = req.params;
    try {
        const request = await PlanChangeRequest.findByPk(requestId);
        if (!request || request.status !== 'pending') {
            return res.status(404).json({ error: 'Request not found or already processed' });
        }

        request.status = 'rejected';
        await request.save();

        res.json({ success: true, message: 'Plan change request rejected.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while rejecting the request.' });
    }
};
