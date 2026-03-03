const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is-auth');
const feesController = require('../controllers/fees');

router.get('/', isAuth, feesController.getAllFees);
router.get('/student/:studentId', isAuth, feesController.getStudentFees);
router.post('/', isAuth, feesController.createFee);
router.put('/:id', isAuth, feesController.updateFee);
router.delete('/:id', isAuth, feesController.deleteFee);
router.post('/:id/upload-invoice', isAuth, feesController.uploadInvoice);
router.post('/:id/upload-proof', isAuth, feesController.uploadProof);

module.exports = router;
