const { validationResult } = require('express-validator');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const CourseDetails = require('../models/CourseDetails');
const Courses = require('../models/Course');

exports.markAttendance = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { studentId, courseDetailsId, date } = req.body;

    // Check if an attendance record already exists for this student, course, and date
    let attendance = await Attendance.findOne({
      where: { studentId, courseDetailsId, date }
    });

    if (attendance) {
      // If a record exists, update it to 'Present'
      attendance.status = 'Present';
      await attendance.save();

      // Return a 200 status code and a flag to indicate record was updated
      return res.status(200).json({ 
        message: 'Attendance record updated successfully', 
        attendance, 
        recordUpdated: true 
      });
    } else {
      // If no record exists, create a new one marked as 'Present'
      attendance = await Attendance.create({
        studentId,
        courseDetailsId,
        date,
        status: 'Present'
      });

      // Return a 201 status code to indicate a new record was created
      return res.status(201).json({ 
        message: 'Attendance marked successfully', 
        attendance, 
        recordUpdated: false 
      });
    }
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.checkAttendanceStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { studentId, courseDetailsId } = req.body;

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Check if an attendance record exists for this student, course, and today's date
    const attendance = await Attendance.findOne({
      where: { studentId, courseDetailsId, date: today }
    });

    if (attendance) {
      // Return 'present' if a record is found
      return res.status(200).json({ 
        status: 'present', 
        message: 'Attendance for today is marked as present.', 
        attendance 
      });
    } else {
      // Return 'absent' if no record is found
      return res.status(200).json({ 
        status: 'absent', 
        message: 'No attendance record found for today.' 
      });
    }
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};


exports.getStudentAttendance = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const attendance = await Attendance.findAll({
      where: { studentId },
      include: [{ model: CourseDetails,  include: [
        {
          model: Courses,
          attributes: ['courseName']
        },
      ], }]
    });

    res.status(200).json({ attendance });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getCourseAttendance = async (req, res, next) => {
  try {
    const { courseDetailsId } = req.params;
    const attendance = await Attendance.findAll({
      where: { courseDetailsId },
      include: [{ model: Student, attributes: ["id", "firstName", "lastName","profileImg"] }]
    });

    res.status(200).json({ attendance });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};