const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expense');
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');

// ── Categories ────────────────────────────────────────────────────────────────
router.get('/categories', isAuth, checkPermission(PERMISSIONS.FINANCE_VIEW), expenseController.getAllCategories);
router.post('/categories', isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), expenseController.createCategory);
router.put('/categories/:id', isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), expenseController.updateCategory);
router.delete('/categories/:id', isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), expenseController.deleteCategory);

// ── Losses (before /:id catch-alls) ──────────────────────────────────────────
router.get('/losses', isAuth, checkPermission(PERMISSIONS.FINANCE_VIEW), expenseController.getAllLosses);
router.post('/losses', isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), expenseController.createLoss);
router.put('/losses/:id', isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), expenseController.updateLoss);
router.delete('/losses/:id', isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), expenseController.deleteLoss);

// ── Expenses ──────────────────────────────────────────────────────────────────
router.get('/summary/total', isAuth, checkPermission(PERMISSIONS.FINANCE_VIEW), expenseController.getTotalExpenses);
router.get('/', isAuth, checkPermission(PERMISSIONS.FINANCE_VIEW), expenseController.getAllExpenses);
router.post('/', isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), expenseController.createExpense);
router.put('/:id', isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), expenseController.updateExpense);
router.delete('/:id', isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), expenseController.deleteExpense);

module.exports = router;
