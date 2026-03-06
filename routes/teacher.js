const express = require('express');
const { body } = require('express-validator');
const teacherController = require('../controllers/teacher');
const Teacher = require('../models/Teacher');
const { loginRateLimiter } = require('../middleware/rateLimiter');
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// ─── Public routes ───────────────────────────────────────────────────────────

router.put('/signup', [
  body('email').isEmail().withMessage('Please enter a valid email.').custom((value) => {
    return Teacher.findOne({ where: { email: value } }).then(userObj => {
      if (userObj) return Promise.reject('E-mail already exist.!');
    });
  }).normalizeEmail(),
  body('username').trim().isLength({ min: 3 }).custom((value) => {
    return Teacher.findOne({ where: { username: value } }).then(userObj => {
      if (userObj) return Promise.reject('Username already exist.!');
    });
  }),
  body('password').trim().isLength({ min: 5 }),
  body('firstName').trim().not().isEmpty(),
], teacherController.signup);

router.post('/login', loginRateLimiter, teacherController.login);

// ─── Admin-only routes ───────────────────────────────────────────────────────

// Check username availability (used during teacher creation)
router.get('/check-username', isAuth, async (req, res) => {
  const { username } = req.query;
  if (!username || String(username).trim().length < 3) {
    return res.status(400).json({ available: false, message: 'Username too short' });
  }
  const existing = await Teacher.findOne({ where: { username: String(username).trim() } });
  res.json({ available: !existing });
});

router.get('/teachers',    isAuth, checkPermission(PERMISSIONS.TEACHERS_VIEW),   teacherController.getAllTeachers);
router.get('/count',       isAuth, checkPermission(PERMISSIONS.TEACHERS_VIEW),   teacherController.countAllTeachers);
router.delete('/:teacherId', isAuth, checkPermission(PERMISSIONS.TEACHERS_DELETE), teacherController.delete);

// ─── Authenticated routes (teacher or admin) ─────────────────────────────────

router.put('/update/:teacherId',                      isAuth, teacherController.update);
router.get('/getById/:teacherId',                     isAuth, teacherController.getTeacherById);
router.get('/dashboard-stats/:teacherId',             isAuth, teacherController.getDashboardStats);
router.post('/getByUsername',                         isAuth, teacherController.getTeacherByUsername);
router.post('/getAssignedStudents',                   isAuth, teacherController.getAssignedStudents);
router.post('/getAssignedTeachers',                   isAuth, teacherController.getAssignedTeachers);
router.post('/upload-image',                          isAuth, teacherController.uploadImage);
router.get('/profileImage/:teacherId',                isAuth, teacherController.getProfileImage);

// Qualifications
router.post('/qualifications',                        isAuth, teacherController.createQualification);
router.get('/qualifications/:teacherId',              isAuth, teacherController.getQualifications);
router.get('/qualifications/:qualificationId',        isAuth, teacherController.getQualification);
router.put('/qualifications/:qualificationId',        isAuth, teacherController.updateQualification);
router.delete('/qualifications/:qualificationId',     isAuth, teacherController.deleteQualification);

// Specializations
router.post('/specializations',                       isAuth, teacherController.addSpecialization);
router.get('/specializations/:teacherId',             isAuth, teacherController.getSpecializations);
router.put('/specializations/:specializationId',      isAuth, teacherController.updateSpecialization);
router.delete('/specializations/:specializationId',   isAuth, teacherController.removeSpecialization);

// Feedback
router.get('/feedback/:teacherId',                    isAuth, teacherController.getFeedback);
router.post('/feedback',                              isAuth, teacherController.addFeedback);
router.post('/feedback/respond/:feedbackId',          isAuth, teacherController.respondToFeedback);

// Class management
router.get('/class-metrics/:teacherId',               isAuth, teacherController.getClassMetrics);
router.get('/upcoming-classes/:teacherId',            isAuth, teacherController.getUpcomingClasses);
router.get('/all-upcoming-classes',                   isAuth, teacherController.getAllUpcomingClasses);
router.post('/upcoming-classes',                      isAuth, teacherController.addUpcomingClass);
router.post('/getMeetingLink',                        isAuth, teacherController.getMeetingLink);
router.delete('/upcoming-classes/:meetingId',         isAuth, teacherController.cancelUpcomingClass);
router.get('/getCountsForProfile/:teacherId',         isAuth, teacherController.getCountTeacherProfileData);

module.exports = router;
