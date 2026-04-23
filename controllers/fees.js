const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const Fee = require('../models/Fee');
const Student = require('../models/Student');
const Plan = require('../models/Plan');
const PlanChangeRequest = require('../models/PlanChangeRequest');
const Admin = require('../models/Admin');

const feeWithRelations = (id) =>
    Fee.findByPk(id, {
        include: [
            { model: Student, attributes: ['id', 'firstName', 'lastName', 'username', 'profileImg'] },
            { model: Plan, attributes: ['id', 'name', 'price', 'billingCycle'] },
            { model: PlanChangeRequest, as: 'planChangeRequest', attributes: ['id', 'status', 'requestedPlanId', 'studentId'] },
            { model: Admin, as: 'CreatedBy', attributes: ['id', 'name', 'username'] },
        ],
    });

// GET /api/fees — Admin: all fees (filterable by ?status=&studentId=)
exports.getAllFees = async (req, res) => {
    try {
        const { Op: SeqOp, fn, col, literal } = require('sequelize');
        const where = {};
        if (req.query.status) where.status = req.query.status;
        if (req.query.studentId) where.studentId = req.query.studentId;
        if (req.query.month) {
            const m = parseInt(req.query.month);
            const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
            const start = new Date(year, m - 1, 1);
            const end   = new Date(year, m, 1);
            where.paidDate = { [Op.gte]: start, [Op.lt]: end };
        }
        const limit = req.query.limit ? parseInt(req.query.limit) : undefined;

        const fees = await Fee.findAll({
            where,
            include: [
                { model: Student, attributes: ['id', 'firstName', 'lastName', 'username', 'profileImg'] },
                { model: Plan, attributes: ['id', 'name', 'price', 'billingCycle'] },
                { model: PlanChangeRequest, as: 'planChangeRequest', attributes: ['id', 'status', 'requestedPlanId'] },
                { model: Admin, as: 'CreatedBy', attributes: ['id', 'name', 'username'] },
            ],
            order: [['createdAt', 'DESC']],
            ...(limit ? { limit } : {}),
        });
        res.json({ fees });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/fees/student/:studentId — Auth: student's own fees
exports.getStudentFees = async (req, res) => {
    try {
        const fees = await Fee.findAll({
            where: { studentId: req.params.studentId },
            include: [
                { model: Plan, attributes: ['id', 'name', 'price', 'billingCycle'] },
            ],
            order: [['dueDate', 'DESC']],
        });
        res.json({ fees });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/fees — Admin: create fee manually
exports.createFee = async (req, res) => {
    try {
        const { studentId, planId, title, amount, dueDate, notes } = req.body;
        const fee = await Fee.create({
            studentId,
            planId: planId || null,
            title,
            amount,
            dueDate,
            notes: notes || null,
            createdById: req.userId || null,
        });
        const full = await feeWithRelations(fee.id);
        res.status(201).json({ fee: full });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PUT /api/fees/:id — Admin: update fee
// When status changes to 'paid' and fee is linked to a PlanChangeRequest:
//   → updates Student.planId to the requested plan
//   → marks PlanChangeRequest as completed
exports.updateFee = async (req, res) => {
    try {
        const fee = await Fee.findByPk(req.params.id);
        if (!fee) return res.status(404).json({ message: 'Fee not found' });

        const { status, notes, dueDate, paidDate, title, amount, planId } = req.body;
        const wasAlreadyPaid = fee.status === 'paid';

        if (status !== undefined) fee.status = status;
        if (notes !== undefined) fee.notes = notes;
        if (dueDate !== undefined) fee.dueDate = dueDate;
        if (paidDate !== undefined) fee.paidDate = paidDate || null;
        if (title !== undefined) fee.title = title;
        if (amount !== undefined) fee.amount = amount;
        if (planId !== undefined) fee.planId = planId || null;

        // Auto-set paidDate when marking as paid
        if (status === 'paid' && !wasAlreadyPaid && !fee.paidDate) {
            fee.paidDate = new Date().toISOString().split('T')[0];
        }

        await fee.save();

        // If this fee is linked to a PlanChangeRequest and is now paid, complete the plan change
        if (status === 'paid' && !wasAlreadyPaid && fee.planChangeRequestId) {
            const planChangeReq = await PlanChangeRequest.findByPk(fee.planChangeRequestId);
            if (planChangeReq && planChangeReq.status === 'approved') {
                // NOW update the student's plan
                await Student.update(
                    { planId: planChangeReq.requestedPlanId },
                    { where: { id: planChangeReq.studentId } }
                );
                planChangeReq.status = 'completed';
                planChangeReq.paymentStatus = 'paid';
                await planChangeReq.save();
            }
        }

        const full = await feeWithRelations(fee.id);
        res.json({ fee: full });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE /api/fees/:id — Admin: delete fee
exports.deleteFee = async (req, res) => {
    try {
        const fee = await Fee.findByPk(req.params.id);
        if (!fee) return res.status(404).json({ message: 'Fee not found' });
        await fee.destroy();
        res.json({ message: 'Fee deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/fees/:id/upload-invoice — Admin: upload official invoice PDF
exports.uploadInvoice = async (req, res) => {
    try {
        const fee = await Fee.findByPk(req.params.id);
        if (!fee) return res.status(404).json({ message: 'Fee not found' });
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        if (fee.invoicePath) {
            fs.unlink(path.join(__dirname, '..', fee.invoicePath), () => {});
        }

        fee.invoicePath = `resources/${req.file.filename}`;
        await fee.save();
        res.json({ fee, message: 'Invoice uploaded successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/fees/:id/upload-proof — Student: upload payment proof
exports.uploadProof = async (req, res) => {
    try {
        const fee = await Fee.findByPk(req.params.id);
        if (!fee) return res.status(404).json({ message: 'Fee not found' });
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        if (fee.proofPath) {
            fs.unlink(path.join(__dirname, '..', fee.proofPath), () => {});
        }

        fee.proofPath = `resources/${req.file.filename}`;
        await fee.save();
        res.json({ fee, message: 'Payment proof uploaded successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
