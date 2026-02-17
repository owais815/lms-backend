const express = require('express');
const { body } = require('express-validator');
const attendanceController = require('../controllers/attendance');
const router = express.Router();

router.post('/mark', [
  body('studentId').isInt(),
  body('courseDetailsId').isInt(),
  body('date').isDate(),
  body('status').isIn(['Present', 'Absent'])
], attendanceController.markAttendance);

router.get('/student/:studentId', attendanceController.getStudentAttendance);
router.get('/course/:courseDetailsId', attendanceController.getCourseAttendance);
router.post('/getStatus', attendanceController.checkAttendanceStatus);

//checkAttendanceStatus
module.exports = router;