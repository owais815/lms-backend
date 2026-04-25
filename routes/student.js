const express = require('express');
const { body } = require('express-validator');
const studentController = require('../controllers/student');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Parent = require('../models/Parent');
const Admin = require('../models/Admin');
const { loginRateLimiter } = require('../middleware/rateLimiter');
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');
const { validatePhone } = require('../utils/phoneCountries');

const router = express.Router();

// ─── Public routes ───────────────────────────────────────────────────────────

router.put('/signup', [
  body('username').trim().isLength({ min: 3 }).custom(async (value) => {
    const [teacher, student, parent, admin] = await Promise.all([
      Teacher.findOne({ where: { username: value } }),
      Student.findOne({ where: { username: value } }),
      Parent.findOne({ where: { username: value } }),
      Admin.findOne({ where: { username: value } }),
    ]);
    if (teacher || student || parent || admin) return Promise.reject('Username already exists.');
  }),
  body('password').trim().isLength({ min: 5 }),
  body('firstName').trim().not().isEmpty(),
  body('contact').optional({ checkFalsy: true }).trim().custom(validatePhone),
], studentController.signup);

router.post('/login', loginRateLimiter, studentController.login);

// ─── Admin-only routes ───────────────────────────────────────────────────────

router.get('/getAll',                  isAuth, checkPermission(PERMISSIONS.STUDENTS_VIEW),   studentController.getAllStudents);
router.post('/bulk-import',            isAuth, checkPermission(PERMISSIONS.STUDENTS_CREATE),  studentController.bulkImport);
router.patch('/:studentId/status',     isAuth, checkPermission(PERMISSIONS.STUDENTS_EDIT),   studentController.toggleStatus);
router.get('/count',         isAuth, checkPermission(PERMISSIONS.STUDENTS_VIEW),   studentController.countAllStudents);
router.get('/country-stats',      isAuth, checkPermission(PERMISSIONS.STUDENTS_VIEW), studentController.countryStats);
router.get('/grade-distribution', isAuth, checkPermission(PERMISSIONS.STUDENTS_VIEW), studentController.gradeDistribution);
router.get('/top-students',  isAuth, checkPermission(PERMISSIONS.STUDENTS_VIEW),   studentController.topStudents);
router.get('/recentCount',   isAuth, checkPermission(PERMISSIONS.STUDENTS_VIEW),   studentController.countRecentStudents);
router.delete('/:studentId', isAuth, checkPermission(PERMISSIONS.STUDENTS_DELETE), studentController.delete);

// ─── Authenticated routes (student or admin) ─────────────────────────────────

router.put('/update/:studentId',                  isAuth, studentController.update);
router.post('/getByUsername',                     isAuth, studentController.getStudentByUsername);
router.get('/getById/:studentId',                 isAuth, studentController.getStudentById);
router.get('/dashboard/:studentId',               isAuth, studentController.getDashboardData);
router.get('/dashboard-stats/:studentId',          isAuth, studentController.getDashboardStats);
router.get('/dashboard/assess/:studentId',        isAuth, studentController.getAssessmentScore);
router.get('/dashboard/leaderboard/:studentId',   isAuth, studentController.getLeaderboard);
router.get('/upcoming-classes/:studentId',        isAuth, studentController.getUpcomingClasses);
router.get('/my-teachers/:studentId',             isAuth, studentController.getMyTeachers);
router.post('/upload-image',                      isAuth, studentController.uploadImage);
router.get('/profileImage/:studentId',            isAuth, studentController.getProfileImage);

module.exports = router;
