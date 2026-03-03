const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is-auth');
const planChangeController = require('../controllers/planchangerequest');

router.post('/request-change', isAuth, planChangeController.requestPlanChange);
router.get('/requests', isAuth, planChangeController.getAllPlanChangeRequests);
router.post('/plan-change-requests/:requestId/approve', isAuth, planChangeController.approvePlanChangeRequest);
router.post('/plan-change-requests/:requestId/reject', isAuth, planChangeController.rejectPlanChangeRequest);

module.exports = router;
