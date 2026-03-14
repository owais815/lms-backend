const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');
const salaryController = require('../controllers/salary');

router.get('/',                       isAuth, checkPermission(PERMISSIONS.SALARY_VIEW),   salaryController.getAllSalaries);
router.get('/teacher/:teacherId',     isAuth,                                              salaryController.getTeacherSalaries);
router.post('/',                      isAuth, checkPermission(PERMISSIONS.SALARY_MANAGE), salaryController.createSalary);
router.put('/:id',                    isAuth, checkPermission(PERMISSIONS.SALARY_MANAGE), salaryController.updateSalary);
router.delete('/:id',                 isAuth, checkPermission(PERMISSIONS.SALARY_MANAGE), salaryController.deleteSalary);
router.post('/:id/upload-proof',      isAuth, checkPermission(PERMISSIONS.SALARY_MANAGE), salaryController.uploadProof);

module.exports = router;
