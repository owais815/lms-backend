const Expense = require('../models/Expense');
const ExpenseCategory = require('../models/ExpenseCategory');
const Admin = require('../models/Admin');
const { Op } = require('sequelize');

// ── Expense Categories ────────────────────────────────────────────────────────

exports.getAllCategories = async (req, res) => {
    try {
        const categories = await ExpenseCategory.findAll({ order: [['name', 'ASC']] });
        res.json({ success: true, categories });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.createCategory = async (req, res) => {
    const { name, status } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required' });
    try {
        const category = await ExpenseCategory.create({ name, status: status || 'Active' });
        res.status(201).json({ success: true, category });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name, status } = req.body;
    try {
        const category = await ExpenseCategory.findByPk(id);
        if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
        await category.update({ name, status });
        res.json({ success: true, category });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.deleteCategory = async (req, res) => {
    const { id } = req.params;
    try {
        const category = await ExpenseCategory.findByPk(id);
        if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
        await category.destroy();
        res.json({ success: true, message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// ── Expenses ─────────────────────────────────────────────────────────────────

exports.getAllExpenses = async (req, res) => {
    const { status, categoryId, startDate, endDate } = req.query;
    const where = {};
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (startDate && endDate) {
        where.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
        where.date = { [Op.gte]: startDate };
    } else if (endDate) {
        where.date = { [Op.lte]: endDate };
    }
    try {
        const expenses = await Expense.findAll({
            where,
            include: [
                { model: ExpenseCategory, as: 'Category', attributes: ['id', 'name'] },
                { model: Admin, as: 'CreatedBy', attributes: ['id', 'name', 'username'] },
            ],
            order: [['date', 'DESC'], ['createdAt', 'DESC']],
        });
        res.json({ success: true, expenses });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.createExpense = async (req, res) => {
    const { title, categoryId, amount, date, purchasedBy, paymentMethod, status, notes } = req.body;
    if (!title || !amount || !date) {
        return res.status(400).json({ success: false, message: 'title, amount, and date are required' });
    }
    try {
        const expense = await Expense.create({
            title,
            categoryId: categoryId || null,
            amount,
            date,
            purchasedBy: purchasedBy || null,
            paymentMethod: paymentMethod || 'Cash',
            status: status || 'New',
            notes: notes || null,
            createdById: req.userId || null,
        });
        const full = await Expense.findByPk(expense.id, {
            include: [{ model: ExpenseCategory, as: 'Category', attributes: ['id', 'name'] }],
        });
        res.status(201).json({ success: true, expense: full });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.updateExpense = async (req, res) => {
    const { id } = req.params;
    try {
        const expense = await Expense.findByPk(id);
        if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
        await expense.update(req.body);
        const full = await Expense.findByPk(id, {
            include: [{ model: ExpenseCategory, as: 'Category', attributes: ['id', 'name'] }],
        });
        res.json({ success: true, expense: full });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.deleteExpense = async (req, res) => {
    const { id } = req.params;
    try {
        const expense = await Expense.findByPk(id);
        if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
        await expense.destroy();
        res.json({ success: true, message: 'Expense deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.getTotalExpenses = async (req, res) => {
    const { year, month } = req.query;
    const where = {};
    if (year && month) {
        const start = `${year}-${String(month).padStart(2, '0')}-01`;
        const end = new Date(year, month, 0).toISOString().slice(0, 10);
        where.date = { [Op.between]: [start, end] };
    } else if (year) {
        where.date = { [Op.between]: [`${year}-01-01`, `${year}-12-31`] };
    }
    try {
        const rows = await Expense.findAll({ where, attributes: ['amount'] });
        const total = rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        res.json({ success: true, totalExpenses: total });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
