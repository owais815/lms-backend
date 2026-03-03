const express = require('express');
const { body } = require('express-validator');
const studentController = require('../controllers/student');
const Student = require('../models/Student');
const { loginRateLimiter } = require('../middleware/rateLimiter');
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// ─── Public routes ───────────────────────────────────────────────────────────

router.put('/signup', [
  body('username').trim().isLength({ min: 3 }).custom((value) => {
    return Student.findOne({ where: { username: value } }).then(userObj => {
      if (userObj) return Promise.reject('Username already exist.!');
    });
  }),
  body('password').trim().isLength({ min: 5 }),
  body('firstName').trim().not().isEmpty(),
], studentController.signup);

router.post('/login', loginRateLimiter, studentController.login);

// ─── Admin-only routes ───────────────────────────────────────────────────────

router.get('/getAll',        isAuth, checkPermission(PERMISSIONS.STUDENTS_VIEW),   studentController.getAllStudents);
router.get('/count',         isAuth, checkPermission(PERMISSIONS.STUDENTS_VIEW),   studentController.countAllStudents);
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
router.post('/upload-image',                      isAuth, studentController.uploadImage);
router.get('/profileImage/:studentId',            isAuth, studentController.getProfileImage);

module.exports = router;
