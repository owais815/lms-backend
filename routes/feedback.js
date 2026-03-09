const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is-auth');
const {
  submitFeedback,
  checkFeedback,
  getSessionFeedback,
  getTeacherFeedback,
  getAdminSummary,
  getStudentFeedback,
} = require('../controllers/feedback');

// Check if student already submitted feedback for a session
router.get('/check/:sessionId', isAuth, checkFeedback);

// Admin: aggregated overview of all feedback
router.get('/admin/summary', isAuth, getAdminSummary);

// Teacher (or admin) feedback for their sessions
router.get('/teacher/:teacherId', isAuth, getTeacherFeedback);

// Get feedback for a specific session (admin: attributed, teacher: anonymous)
router.get('/session/:sessionId', isAuth, getSessionFeedback);

// Student submits feedback
router.post('/session/:sessionId', isAuth, submitFeedback);

// Admin: all feedback submitted by a specific student
router.get('/student/:studentId', isAuth, getStudentFeedback);

module.exports = router;
