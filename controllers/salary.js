const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const Salary = require('../models/Salary');
const Teacher = require('../models/Teacher');
const Admin = require('../models/Admin');

const salaryWithRelations = (id) =>
    Salary.findByPk(id, {
        include: [
            { model: Teacher, attributes: ['id', 'firstName', 'lastName', 'email'] },
            { model: Admin, as: 'CreatedBy', attributes: ['id', 'name', 'username'] },
        ],
    });

// GET /api/salary — all salaries (filterable by ?teacherId=&status=&month=)
exports.getAllSalaries = async (req, res) => {
    try {
        const where = {};
        if (req.query.teacherId) where.teacherId = req.query.teacherId;
        if (req.query.status)    where.status    = req.query.status;
        if (req.query.month)     where.month     = req.query.month;

        const salaries = await Salary.findAll({
            where,
            include: [
                { model: Teacher, attributes: ['id', 'firstName', 'lastName', 'email'] },
                { model: Admin, as: 'CreatedBy', attributes: ['id', 'name', 'username'] },
            ],
            order: [['month', 'DESC'], ['createdAt', 'DESC']],
        });
        res.json({ salaries });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/salary/teacher/:teacherId — teacher's own salary history
exports.getTeacherSalaries = async (req, res) => {
    try {
        const salaries = await Salary.findAll({
            where: { teacherId: req.params.teacherId },
            order: [['month', 'DESC']],
        });
        res.json({ salaries });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/salary — create salary record
exports.createSalary = async (req, res) => {
    try {
        const { teacherId, amount, month, dueDate, status, paidDate, notes } = req.body;

        const salary = await Salary.create({
            teacherId,
            amount,
            month,
            dueDate: dueDate || null,
            status:  status || 'unpaid',
            paidDate: paidDate || null,
            notes:   notes   || null,
            createdById: req.userId || null,
        });

        const result = await salaryWithRelations(salary.id);
        res.status(201).json({ salary: result });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// PUT /api/salary/:id — update salary record
exports.updateSalary = async (req, res) => {
    try {
        const salary = await Salary.findByPk(req.params.id);
        if (!salary) return res.status(404).json({ message: 'Salary record not found' });

        const { amount, month, dueDate, status, paidDate, notes } = req.body;

        if (amount   !== undefined) salary.amount  = amount;
        if (month    !== undefined) salary.month   = month;
        if (dueDate  !== undefined) salary.dueDate = dueDate || null;
        if (status   !== undefined) salary.status  = status;
        if (paidDate !== undefined) salary.paidDate = paidDate || null;
        if (notes    !== undefined) salary.notes   = notes || null;

        // Auto-set paidDate when marking as paid
        if (status === 'paid' && !salary.paidDate) {
            salary.paidDate = new Date().toISOString().split('T')[0];
        }

        await salary.save();
        const result = await salaryWithRelations(salary.id);
        res.json({ salary: result });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE /api/salary/:id
exports.deleteSalary = async (req, res) => {
    try {
        const salary = await Salary.findByPk(req.params.id);
        if (!salary) return res.status(404).json({ message: 'Salary record not found' });

        // Clean up proof file if exists
        if (salary.proofPath) {
            fs.unlink(path.join(__dirname, '..', salary.proofPath), () => {});
        }

        await salary.destroy();
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/salary/:id/upload-proof — upload salary proof (PDF or image)
exports.uploadProof = async (req, res) => {
    try {
        const salary = await Salary.findByPk(req.params.id);
        if (!salary) return res.status(404).json({ message: 'Salary record not found' });
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const mime = req.file.mimetype;
        const allowed = ['image/png', 'image/jpg', 'image/jpeg', 'application/pdf'];
        if (!allowed.includes(mime)) {
            fs.unlink(req.file.path, () => {});
            return res.status(400).json({ message: 'Only PDF or image files are allowed.' });
        }

        // Remove old proof file
        if (salary.proofPath) {
            fs.unlink(path.join(__dirname, '..', salary.proofPath), () => {});
        }

        salary.proofPath = `resources/${req.file.filename}`;
        await salary.save();

        const result = await salaryWithRelations(salary.id);
        res.json({ salary: result, message: 'Proof uploaded successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
