const express = require('express');
const {body} = require('express-validator');
const courseController = require('../controllers/courseDetails');
const Admin = require('../models/Admin');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');

const router = express.Router();

router.put('/assignCourse',[
    body('courseId').not().isEmpty(),
    body('studentId').custom((value,{req})=>{
        return Student.findOne({where:{id:value}}).then(userObj=>{
            if(!userObj){
                return Promise.reject("Student doesn't exist!");
            }
        })
    })
],courseController.addCourse);
router.delete('/:courseId',courseController.deleteCourse);
router.put('/:courseId',courseController.updateCourse);
router.get('/getCourseById/:courseId', courseController.getCourseById);
router.get('/getCourseByStdId/:stdId', courseController.getCourseByStdId);
router.get('/getCourseByStdAndTeacherId/:stdId/:teacherId', courseController.getCourseByStdAndTeacherId);
router.post('/getCourseByStdAndCourseId', courseController.getCourseByStdAndCourseIds);
router.get('/getCourseByTeacherId/:teacherId', courseController.getCourseByTeacherId);
router.get('/getCourses', courseController.getCourses);
router.get('/getUniqueCourses', courseController.getUniqueCourses);


module.exports = router;
