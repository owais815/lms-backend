const express = require('express');
const {body} = require('express-validator');
const courseController = require('../controllers/courseDetails');
const Student = require('../models/Student');
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.put('/assignCourse', isAuth, checkPermission(PERMISSIONS.COURSES_CREATE), [
    body('courseId').not().isEmpty(),
    body('studentId').custom((value,{req})=>{
        return Student.findOne({where:{id:value}}).then(userObj=>{
            if(!userObj){
                return Promise.reject("Student doesn't exist!");
            }
        })
    })
], courseController.addCourse);

router.delete('/:courseId',                                   isAuth, checkPermission(PERMISSIONS.COURSES_DELETE), courseController.deleteCourse);
router.put('/:courseId',                                      isAuth, checkPermission(PERMISSIONS.COURSES_EDIT),   courseController.updateCourse);
router.get('/getCourseById/:courseId',                        isAuth, courseController.getCourseById);
router.get('/getCourseByStdId/:stdId',                        isAuth, courseController.getCourseByStdId);
router.get('/getCourseByStdAndTeacherId/:stdId/:teacherId',   isAuth, courseController.getCourseByStdAndTeacherId);
router.post('/getCourseByStdAndCourseId',                     isAuth, courseController.getCourseByStdAndCourseIds);
router.get('/getCourseByTeacherId/:teacherId',                isAuth, courseController.getCourseByTeacherId);
router.get('/getCourses',                                     isAuth, courseController.getCourses);
router.get('/getUniqueCourses',                               isAuth, courseController.getUniqueCourses);

module.exports = router;
