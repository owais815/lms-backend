const cron = require('node-cron');
const moment = require('moment-timezone');
const { Op } = require('sequelize');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const CourseDetails = require('../models/CourseDetails');

// Function to mark absent students
async function markAbsentStudents() {
  const today = moment().tz('Asia/Karachi').format('YYYY-MM-DD');
  
  try {
    // Get all students
    const students = await Student.findAll();
    
    // Get all courses
    const courses = await CourseDetails.findAll();
    
    for (const student of students) {
      for (const course of courses) {
        // Check if attendance already marked for this student and course today
        const existingAttendance = await Attendance.findOne({
          where: {
            studentId: student.id,
            courseId: course.id,
            date: today
          }
        });
        
        // If no attendance record exists, mark as absent
        if (!existingAttendance) {
          await Attendance.create({
            studentId: student.id,
            courseId: course.id,
            date: today,
            status: 'Absent'
          });
        }
      }
    }
    
    console.log('Absent students marked successfully');
  } catch (error) {
    console.error('Error marking absent students:', error);
  }
}

// Schedule the task to run at 6 AM (Germany) => 9 AM (Pakistan)
cron.schedule('0 6 * * *', markAbsentStudents);

module.exports = {
  markAbsentStudents // Export for manual triggering if needed
};
