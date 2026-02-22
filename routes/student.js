const express = require('express');
const {body} = require('express-validator');
const Admin = require('../models/Admin');
const studentController = require('../controllers/student');
const Student = require('../models/Student');
const { loginRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.put('/signup',[
    
    body('username').trim().isLength({min:3}).custom((value,{req})=>{
        return Student.findOne({where:{username:value}}).then(userObj=>{
            if(userObj){
                return Promise.reject("Username already exist.!");
            }
        })
    }),
    body('password').trim().isLength({min:5}),
    body('firstName').trim().not().isEmpty()
],studentController.signup);


router.post('/login', loginRateLimiter, studentController.login);
router.delete('/:studentId',studentController.delete);
router.put('/update/:studentId',studentController.update);
router.post('/getByUsername',studentController.getStudentByUsername);
router.get('/getAll',studentController.getAllStudents);
router.get('/getById/:studentId',studentController.getStudentById);
router.get('/dashboard/:studentId',studentController.getDashboardData);
router.get('/dashboard/assess/:studentId',studentController.getAssessmentScore);
router.get('/dashboard/leaderboard/:studentId',studentController.getLeaderboard);
router.get('/upcoming-classes/:studentId', studentController.getUpcomingClasses);
router.post('/upload-image', studentController.uploadImage);
router.get('/profileImage/:studentId', studentController.getProfileImage);
router.post('/upload-image', studentController.uploadImage);
router.get('/count',studentController.countAllStudents);
router.get('/recentCount',studentController.countRecentStudents);







module.exports = router;
