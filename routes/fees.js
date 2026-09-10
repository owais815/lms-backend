const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');
const feesController = require('../controllers/fees');

// Admin: get all fees
router.get('/',                       isAuth, checkPermission(PERMISSIONS.FINANCE_VIEW),   feesController.getAllFees);
// Student or admin: get a student's fees
router.get('/student/:studentId',     isAuth, feesController.getStudentFees);
// Admin: create fee
router.post('/',                      isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), feesController.createFee);
// Admin: update fee
router.put('/:id',                    isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), feesController.updateFee);
// Admin: delete fee
router.delete('/:id',                 isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), feesController.deleteFee);
// Admin: upload invoice
router.post('/:id/upload-invoice',    isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), feesController.uploadInvoice);
// Student or admin: upload payment proof
router.post('/:id/upload-proof',      isAuth, feesController.uploadProof);
// Admin: proof matches — confirm payment
router.put('/:id/verify-proof',       isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), feesController.verifyProof);
// Admin: proof mismatch — ask for resubmission
router.put('/:id/reject-proof',       isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), feesController.rejectProof);
// Admin: nudge student/parent to share proof
router.post('/:id/remind-proof',      isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), feesController.remindProof);

module.exports = router;
