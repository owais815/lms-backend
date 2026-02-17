
const express = require('express');
const router = express.Router();
const planController = require('../controllers/plan');

router.get('/plans', planController.getPlans);
router.post('/students/assign-plan', planController.assignPlan);
router.get('/students/:studentId/plan', planController.getStudentPlan);

// Admin routes
router.post('/add', planController.addPlan); // Add plan
router.get('/all', planController.getPlans); // View all plans
router.put('/update/:id', planController.updatePlan); // Update plan
router.delete('/delete/:id', planController.deletePlan); // Delete plan
//student
router.post('/plan-change-requests', planController.createPlanChangeRequest);

module.exports = router;
