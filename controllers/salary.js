const { Op } = require('sequelize');
const Salary = require('../models/Salary');
const Teacher = require('../models/Teacher');

// GET /api/salary — all salaries (filterable by ?teacherId=&status=&month=)
exports.getAllSalaries = async (req, res) => {
    try {
        const where = {};
        if (req.query.teacherId) where.teacherId = req.query.teacherId;
        if (req.query.status) where.status = req.query.status;
        if (req.query.month) where.month = req.query.month;

        const salaries = await Salary.findAll({
            where,
            include: [{ model: Teacher, attributes: ['id', 'firstName', 'lastName', 'email'] }],
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
        const { teacherId, amount, month, status, paidDate, notes } = req.body;
        const salary = await Salary.create({ teacherId, amount, month, status, paidDate, notes });
        const result = await Salary.findByPk(salary.id, {
            include: [{ model: Teacher, attributes: ['id', 'firstName', 'lastName', 'email'] }],
        });
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

        const { amount, month, status, paidDate, notes } = req.body;
        await salary.update({ amount, month, status, paidDate, notes });
        const result = await Salary.findByPk(salary.id, {
            include: [{ model: Teacher, attributes: ['id', 'firstName', 'lastName', 'email'] }],
        });
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
        await salary.destroy();
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
