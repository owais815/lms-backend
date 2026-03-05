const express = require('express');
const router = express.Router();
const upcomingCoursesController = require('../controllers/upcomingCourse');
const isAuth = require('../middleware/is-auth');

router.post('/',                                     isAuth, upcomingCoursesController.createUpcomingCourse);
router.get('/',                                      isAuth, upcomingCoursesController.getAllUpcomingCourses);
router.get('/:id',                                   isAuth, upcomingCoursesController.getUpcomingCourseById);
router.put('/:id',                                   isAuth, upcomingCoursesController.updateUpcomingCourse);
router.delete('/:id',                                isAuth, upcomingCoursesController.deleteUpcomingCourse);
router.post('/enroll',                               isAuth, upcomingCoursesController.enrollStudent);
router.get('/enrolledCourses/:studentId',            isAuth, upcomingCoursesController.getEnrolledCoursesOfStd);
router.get('/enrolledCoursesWithCourseId/:courseId', isAuth, upcomingCoursesController.getEnrolledCoursesOfCourses);

module.exports = router;
