
const express = require('express');
const router = express.Router();
const planController = require('../controllers/plan');
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');

router.get('/plans', isAuth, planController.getPlans);
router.post('/students/assign-plan', isAuth, planController.assignPlan);
router.get('/students/:studentId/plan', isAuth, planController.getStudentPlan);

// Admin routes — require plans:manage permission
router.post('/add', isAuth, checkPermission(PERMISSIONS.PLANS_MANAGE), planController.addPlan);
router.get('/all', isAuth, planController.getPlans);
router.put('/update/:id', isAuth, checkPermission(PERMISSIONS.PLANS_MANAGE), planController.updatePlan);
router.delete('/delete/:id', isAuth, checkPermission(PERMISSIONS.PLANS_MANAGE), planController.deletePlan);

// Student routes
router.post('/plan-change-requests', isAuth, planController.createPlanChangeRequest);

module.exports = router;
