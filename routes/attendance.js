const express = require('express');
const { body } = require('express-validator');
const attendanceController = require('../controllers/attendance');
const router = express.Router();

// Legacy: mark single attendance
router.post('/mark', [
  body('studentId').isInt(),
  body('courseDetailsId').isInt(),
  body('date').isDate(),
  body('status').isIn(['Present', 'Absent'])
], attendanceController.markAttendance);

// Legacy: check today's attendance status
router.post('/getStatus', attendanceController.checkAttendanceStatus);

// Legacy: get all attendance for a course
router.get('/course/:courseDetailsId', attendanceController.getCourseAttendance);

// Session-based: bulk mark attendance for a session
router.post('/bulk-mark', attendanceController.bulkMarkAttendance);

// Session-based: get attendance sheet for a session (students + existing status)
router.get('/session/:sessionId', attendanceController.getSessionAttendanceSheet);

// Teacher: get their sessions for the dropdown
router.get('/teacher/:teacherId/sessions', attendanceController.getTeacherSessions);

// Student: per-course attendance summary with percentages
router.get('/student/:studentId/summary', attendanceController.getStudentAttendanceSummary);

// Student: full attendance history (with optional filters)
router.get('/student/:studentId', attendanceController.getStudentAttendance);

// Admin: filtered overview of all student attendance
router.get('/admin/students', attendanceController.getAdminStudentAttendance);

module.exports = router;
