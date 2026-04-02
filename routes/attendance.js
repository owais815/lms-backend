const express = require('express');
const { body } = require('express-validator');
const attendanceController = require('../controllers/attendance');
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// ─── Legacy routes (teacher / admin) ─────────────────────────────────────────
router.post('/mark', [
  body('studentId').isInt(),
  body('courseDetailsId').isInt(),
  body('date').isDate(),
  body('status').isIn(['Present', 'Absent']),
], isAuth, attendanceController.markAttendance);

router.post('/getStatus',              isAuth, attendanceController.checkAttendanceStatus);
router.get('/course/:courseDetailsId', isAuth, attendanceController.getCourseAttendance);

// ─── Session-based routes ─────────────────────────────────────────────────────
router.post('/bulk-mark',              isAuth, attendanceController.bulkMarkAttendance);
router.get('/session/:sessionId',      isAuth, attendanceController.getSessionAttendanceSheet);
router.get('/teacher/:teacherId/sessions', isAuth, attendanceController.getTeacherSessions);

// ─── Student-facing routes ───────────────────────────────────────────────────
router.get('/student/:studentId/summary', isAuth, attendanceController.getStudentAttendanceSummary);
router.get('/student/:studentId',         isAuth, attendanceController.getStudentAttendance);

// ─── Admin-only routes ───────────────────────────────────────────────────────
router.get('/admin/students', isAuth, checkPermission(PERMISSIONS.ATTENDANCE_VIEW), attendanceController.getAdminStudentAttendance);

module.exports = router;
