const express = require('express');
const router = express.Router();
const upcomingCoursesController = require('../controllers/upcomingCourse');

// Create a new upcoming course
router.post('/', upcomingCoursesController.createUpcomingCourse);

// Get all upcoming courses
router.get('/', upcomingCoursesController.getAllUpcomingCourses);

// Get an upcoming course by ID
router.get('/:id', upcomingCoursesController.getUpcomingCourseById);

// Update an upcoming course by ID
router.put('/:id', upcomingCoursesController.updateUpcomingCourse);

// Delete an upcoming course by ID
router.delete('/:id', upcomingCoursesController.deleteUpcomingCourse);

//enroll student
router.post('/enroll',upcomingCoursesController.enrollStudent);

//get enrolled courses of student
router.get('/enrolledCourses/:studentId',upcomingCoursesController.getEnrolledCoursesOfStd);
//get enrollments with course id
router.get('/enrolledCoursesWithCourseId/:courseId',upcomingCoursesController.getEnrolledCoursesOfCourses);


module.exports = router;
