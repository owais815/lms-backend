const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');
const salaryController = require('../controllers/salary');

// Admin: get all salaries
router.get('/', isAuth, checkPermission(PERMISSIONS.SALARY_VIEW), salaryController.getAllSalaries);
// Teacher or admin: get a teacher's salary history
router.get('/teacher/:teacherId', isAuth, salaryController.getTeacherSalaries);
// Admin: create salary record
router.post('/', isAuth, checkPermission(PERMISSIONS.SALARY_MANAGE), salaryController.createSalary);
// Admin: update salary record
router.put('/:id', isAuth, checkPermission(PERMISSIONS.SALARY_MANAGE), salaryController.updateSalary);
// Admin: delete salary record
router.delete('/:id', isAuth, checkPermission(PERMISSIONS.SALARY_MANAGE), salaryController.deleteSalary);

module.exports = router;
