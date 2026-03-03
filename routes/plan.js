
const express = require('express');
const router = express.Router();
const planController = require('../controllers/plan');
const isAuth = require('../middleware/is-auth');

router.get('/plans', isAuth, planController.getPlans);
router.post('/students/assign-plan', isAuth, planController.assignPlan);
router.get('/students/:studentId/plan', isAuth, planController.getStudentPlan);

// Admin routes
router.post('/add', isAuth, planController.addPlan);
router.get('/all', isAuth, planController.getPlans);
router.put('/update/:id', isAuth, planController.updatePlan);
router.delete('/delete/:id', isAuth, planController.deletePlan);

// Student routes
router.post('/plan-change-requests', isAuth, planController.createPlanChangeRequest);

module.exports = router;
