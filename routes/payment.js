const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment');

// Record a payment
router.post('/record', paymentController.recordPayment);

// Get payments of a specific student
router.get('/student/:studentId', paymentController.getStudentPayments);

// Get total revenue
router.get('/revenue/total', paymentController.getTotalRevenue);

// Get payments within a date range
router.post('/revenue/date-range', paymentController.getPaymentsByDateRange);

//add monthly fee.
router.post('/add-monthly-fee', paymentController.addMonthlyFee);

// Admin: Get all payments
router.get('/payments', paymentController.getAllPayments);

module.exports = router;
