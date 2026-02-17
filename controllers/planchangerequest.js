
const Payment = require('../models/Payment');
const Plan = require('../models/Plan');
const PlanChangeRequest = require('../models/PlanChangeRequest');
const Student = require('../models/Student');


// Controller to approve plan change and handle payment
exports.approvePlanChange = async (req, res) => {
    const { requestId, amount } = req.body;

    try {
        // Step 1: Approve the plan change request
        const request = await PlanChangeRequest.findByPk(requestId);

        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        // Update the request to approved
        request.status = 'approved';
        await request.save();

        // Step 2: Record the payment
        const payment = await Payment.create({
            studentId: request.studentId,
            amount,
            purpose: 'Plan Upgrade/Downgrade',
        });

        // Step 3: Update the student's plan
        await Student.update(
            { planId: request.newPlanId },
            { where: { id: request.studentId } }
        );

        res.status(200).json({
            success: true,
            message: 'Plan change approved, payment recorded, and student plan updated.',
            payment,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};


exports.requestPlanChange = async (req, res) => {
    const { studentId, requestedPlanId } = req.body;

    try {
        const student = await Student.findByPk(studentId, { include: 'Plan' });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        const currentPlanId = student.planId;

        // Check if a request already exists
        const existingRequest = await PlanChangeRequest.findOne({
            where: { studentId, status: 'pending' },
        });

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: 'You already have a pending plan change request.',
            });
        }

        const request = await PlanChangeRequest.create({
            studentId,
            currentPlanId,
            requestedPlanId,
        });

        res.status(201).json({ success: true, message: 'Plan change request submitted.', request });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

//Admin: View All Plan Change Requests

exports.getAllPlanChangeRequests = async (req, res) => {
    try {
        const requests = await PlanChangeRequest.findAll({
            include: [
                { model: Student, attributes: ['firstName', 'lastName'] },
                { model: Plan, as: 'CurrentPlan', attributes: ['name', 'price'] },
                { model: Plan, as: 'RequestedPlan', attributes: ['name', 'price'] },
            ],
        });

        res.status(200).json({ success: true, requests });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

//Admin: Approve or Reject Request
exports.updatePlanChangeRequestStatus = async (req, res) => {
    const { requestId, status } = req.body;

    try {
        const request = await PlanChangeRequest.findByPk(requestId);

        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        if (status === 'approved') {
            request.status = 'approved';
        } else if (status === 'rejected') {
            request.status = 'rejected';
        } else {
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }

        await request.save();

        res.status(200).json({ success: true, message: 'Request updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

//Student: Make Payment
exports.markPaymentAsCompleted = async (req, res) => {
    const { requestId } = req.body;

    try {
        const request = await PlanChangeRequest.findByPk(requestId);
        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }
        if (request.status !== 'approved') {
            return res.status(400).json({
                success: false,
                message: 'Request must be approved before payment can be completed.',
            });
        }

        request.paymentStatus = 'paid';

        // Update the student's plan if payment is completed
        const student = await Student.findByPk(request.studentId);
        student.planId = request.requestedPlanId;
        await student.save();

        await request.save();

        res.status(200).json({ success: true, message: 'Payment completed and plan updated.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};


exports.approvePlanChangeRequest = async (req, res) => {
    const { requestId } = req.params;
    try {
        const request = await PlanChangeRequest.findByPk(requestId);
        if (!request || request.status !== 'pending') {
            return res.status(404).json({ error: 'Request not found or already processed' });
        }

        // Update student's plan
        const student = await Student.findByPk(request.studentId);
        student.planId = request.requestedPlanId;
        await student.save();

        // Update request status
        request.status = 'approved';
        await request.save();

        res.json({ success: true, message: 'Plan change request approved successfully!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while approving the request.' });
    }
};

exports.rejectPlanChangeRequest = async (req, res) => {
    const { requestId } = req.params;

    try {
        const request = await PlanChangeRequest.findByPk(requestId);
        if (!request || request.status !== 'pending') {
            return res.status(404).json({ error: 'Request not found or already processed' });
        }

        // Update request status
        request.status = 'rejected';
        await request.save();

        res.json({ success: true, message: 'Plan change request rejected successfully!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while rejecting the request.' });
    }
};




