const Payment = require('../models/Payment');
const PlanChangeRequest = require('../models/PlanChangeRequest');
const Student = require('../models/Student');
const { Op, Sequelize } = require("sequelize");

exports.recordPayment = async (req, res) => {
    const { studentId, amount, purpose } = req.body;

    try {
        // Verify student exists
        const student = await Student.findByPk(studentId);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        // Record the payment
        const payment = await Payment.create({
            studentId,
            amount,
            purpose,
        });

        res.status(201).json({
            success: true,
            message: 'Payment recorded successfully.',
            payment,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getStudentPayments = async (req, res) => {
    const { studentId } = req.params;

    try {
        const payments = await Payment.findAll({
            where: { studentId },
            include: { model: Student, attributes: ['firstName', 'lastName'] },
            order: [['createdAt', 'DESC']],
        });

        res.status(200).json({
            success: true,
            payments,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getTotalRevenue = async (req, res) => {
    try {
        // Get the start and end of the current year
        const currentYear = new Date().getFullYear();
        const startOfYear = new Date(currentYear, 0, 1); // January 1st of the current year
        const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59); // December 31st of the current year

        const totalRevenue = await Payment.sum('amount', {
            where: {
                createdAt: {
                    [Op.between]: [startOfYear, endOfYear],
                },
            },
        });

        res.status(200).json({
            success: true,
            totalRevenue,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getPaymentsByDateRange = async (req, res) => {
    const { startDate, endDate } = req.body;

    try {
        const payments = await Payment.findAll({
            where: {
                paymentDate: {
                    [Sequelize.Op.between]: [new Date(startDate), new Date(endDate)],
                },
            },
            include: { model: Student, attributes: ['firstName', 'lastName'] },
        });

        const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);

        res.status(200).json({
            success: true,
            payments,
            totalRevenue,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.addMonthlyFee = async (req, res) => {
    const { studentId, amount } = req.body;

    try {
        const student = await Student.findByPk(studentId);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        const payment = await Payment.create({
            studentId,
            amount,
            purpose: 'Monthly Fee',
        });

        res.status(201).json({
            success: true,
            message: 'Monthly fee recorded successfully.',
            payment,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Individual payment records for a date range (used for weekly grouping)
exports.getPaymentRecords = async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const where = {};
        if (startDate && endDate) {
            where.paymentDate = { [Op.between]: [new Date(startDate), new Date(endDate)] };
        }
        const payments = await Payment.findAll({
            where,
            attributes: ['amount', 'paymentDate'],
            order: [['paymentDate', 'ASC']],
        });
        res.json({ success: true, payments });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Monthly revenue breakdown — returns 12 rows {month, revenue} for the given year
exports.getMonthlyBreakdown = async (req, res) => {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month) : null; // 1-12, optional filter

    try {
        const startOfYear = new Date(year, 0, 1);
        const endOfYear   = new Date(year, 11, 31, 23, 59, 59);

        const payments = await Payment.findAll({
            where: {
                paymentDate: { [Op.between]: [startOfYear, endOfYear] },
            },
            attributes: ['amount', 'paymentDate'],
        });

        // Group into 12 buckets
        const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, revenue: 0 }));
        payments.forEach((p) => {
            const m = new Date(p.paymentDate).getMonth(); // 0-based
            monthly[m].revenue += parseFloat(p.amount || 0);
        });

        const result = month ? monthly.filter((r) => r.month === month) : monthly;
        res.json({ success: true, year, monthly: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

//get all payments history admin
exports.getAllPayments = async (req, res) => {
    try {
        const payments = await Payment.findAll({
            include: [
                {
                    model: Student,
                    attributes: ['id', 'username', 'firstName', 'lastName'],
                },
            ],
            order: [['createdAt', 'DESC']],
        });

        res.status(200).json({ success: true, payments });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};