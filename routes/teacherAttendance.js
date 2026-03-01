const express = require('express');
const router = express.Router();
const teacherAttendanceController = require('../controllers/teacherAttendance');

// Teacher self-attendance
router.post('/check-in', teacherAttendanceController.checkIn);
router.post('/check-out', teacherAttendanceController.checkOut);
router.get('/today/:teacherId', teacherAttendanceController.getToday);
router.get('/history/:teacherId', teacherAttendanceController.getHistory);

// Admin overview
router.get('/admin/overview', teacherAttendanceController.adminOverview);

module.exports = router;
