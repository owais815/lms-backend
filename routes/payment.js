const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment');
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');

// Record a payment
router.post('/record', isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), paymentController.recordPayment);

// Get payments of a specific student (student can see own, admin sees any)
router.get('/student/:studentId', isAuth, paymentController.getStudentPayments);

// Get total revenue (admin/finance only)
router.get('/revenue/total', isAuth, checkPermission(PERMISSIONS.FINANCE_VIEW), paymentController.getTotalRevenue);

// Get payments within a date range (admin/finance only)
router.post('/revenue/date-range', isAuth, checkPermission(PERMISSIONS.FINANCE_VIEW), paymentController.getPaymentsByDateRange);

// Add monthly fee (admin/finance only)
router.post('/add-monthly-fee', isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), paymentController.addMonthlyFee);

// Admin: Get all payments
router.get('/payments', isAuth, checkPermission(PERMISSIONS.FINANCE_VIEW), paymentController.getAllPayments);

module.exports = router;
