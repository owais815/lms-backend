const express = require('express');
const {body} = require('express-validator');
const teacherController = require('../controllers/teacher');
const Teacher = require('../models/Teacher');
const { loginRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.put('/signup',[
    body('email').isEmail().withMessage("Please enter a valid email.").custom((value,{req})=>{
        return Teacher.findOne({where:{email:value}}).then(userObj=>{
            if(userObj){
                return Promise.reject("E-mail already exist.!");
            }
        })
    }).normalizeEmail(),
    // email validation ends here
    body('username').trim().isLength({min:3}).custom((value,{req})=>{
        return Teacher.findOne({where:{username:value}}).then(userObj=>{
            if(userObj){
                return Promise.reject("Username already exist.!");
            }
        })
    }),
    body('password').trim().isLength({min:5}),
    body('firstName').trim().not().isEmpty()
],teacherController.signup);


router.post('/login', loginRateLimiter, teacherController.login);
router.put('/update/:teacherId',teacherController.update);
router.delete('/:teacherId',teacherController.delete);
router.get('/teachers', teacherController.getAllTeachers);
router.get('/getById/:teacherId', teacherController.getTeacherById);
router.post('/getByUsername', teacherController.getTeacherByUsername);
router.post('/getAssignedStudents', teacherController.getAssignedStudents);
router.post('/getAssignedTeachers', teacherController.getAssignedTeachers);

router.post('/upload-image', teacherController.uploadImage);
router.get('/profileImage/:teacherId', teacherController.getProfileImage);
//Teacher Qualifications
router.post('/qualifications', teacherController.createQualification);
router.get('/qualifications/:teacherId', teacherController.getQualifications);
router.get('/qualifications/:qualificationId', teacherController.getQualification);
router.put('/qualifications/:qualificationId', teacherController.updateQualification);
router.delete('/qualifications/:qualificationId', teacherController.deleteQualification);
//Specialization
router.post('/specializations', teacherController.addSpecialization);
router.get('/specializations/:teacherId', teacherController.getSpecializations);
router.put('/specializations/:specializationId', teacherController.updateSpecialization);
router.delete('/specializations/:specializationId', teacherController.removeSpecialization);
// Feedback routes
router.get('/feedback/:teacherId', teacherController.getFeedback);
router.post('/feedback', teacherController.addFeedback);
router.post('/feedback/respond/:feedbackId', teacherController.respondToFeedback);
// Class metrics routes
router.get('/class-metrics/:teacherId', teacherController.getClassMetrics);
// Upcoming classes routes getMeetingLink
router.get('/upcoming-classes/:teacherId', teacherController.getUpcomingClasses);
router.get('/all-upcoming-classes', teacherController.getAllUpcomingClasses);
router.post('/upcoming-classes',teacherController.addUpcomingClass);
router.post('/getMeetingLink',teacherController.getMeetingLink);
router.delete('/upcoming-classes/:meetingId',teacherController.cancelUpcomingClass);
router.get('/getCountsForProfile/:teacherId',teacherController.getCountTeacherProfileData);
router.get('/count',teacherController.countAllTeachers);



module.exports = router;
