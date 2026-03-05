const express = require('express');
const router = express.Router();
const teacherAttendanceController = require('../controllers/teacherAttendance');
const isAuth = require('../middleware/is-auth');

// Teacher self-attendance
router.post('/check-in', isAuth, teacherAttendanceController.checkIn);
router.post('/check-out', isAuth, teacherAttendanceController.checkOut);
router.get('/today/:teacherId', isAuth, teacherAttendanceController.getToday);
router.get('/history/:teacherId', isAuth, teacherAttendanceController.getHistory);

// Admin overview
router.get('/admin/overview', isAuth, teacherAttendanceController.adminOverview);

module.exports = router;
