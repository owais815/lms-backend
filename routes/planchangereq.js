const express = require('express');
const router = express.Router();
const planChangeController = require('../controllers/planchangerequest');

router.post('/request-change', planChangeController.requestPlanChange);
router.get('/requests', planChangeController.getAllPlanChangeRequests);
router.put('/requests/status', planChangeController.updatePlanChangeRequestStatus);
router.post('/requests/payment', planChangeController.markPaymentAsCompleted);
router.post('/plan-change-requests/:requestId/approve', planChangeController.approvePlanChangeRequest);
router.post('/plan-change-requests/:requestId/reject', planChangeController.rejectPlanChangeRequest);
module.exports = router;
