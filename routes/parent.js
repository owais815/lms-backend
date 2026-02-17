const express = require('express');
const {body} = require('express-validator');
const Admin = require('../models/Admin');
const parentController = require('../controllers/parent');
const Student = require('../models/Student');

const router = express.Router();

router.put('/signup',[
    body('email').isEmail().withMessage("Please enter a valid email.").custom((value,{req})=>{
        return Student.findOne({where:{email:value}}).then(userObj=>{
            if(userObj){
                return Promise.reject("E-mail already exist.!");
            }
        })
    }).normalizeEmail(),
    body('username').trim().isLength({min:3}).custom((value,{req})=>{
        return Student.findOne({where:{username:value}}).then(userObj=>{
            if(userObj){
                return Promise.reject("Username already exist.!");
            }
        })
    }),
    body('password').trim().isLength({min:5}),
    body('firstName').trim().not().isEmpty()
],parentController.signup);


router.post('/login',parentController.login);
router.delete('/:parentId',parentController.delete);
router.put('/update/:parentId',parentController.update);
router.post('/getByUsername',parentController.getStudentByUsername);
router.get('/getAll',parentController.getAllParents);
router.get('/getById/:parentId',parentController.getParentById);
router.get('/dashboard/:studentId',parentController.getDashboardData);
router.get('/dashboard/assess/:studentId',parentController.getAssessmentScore);
router.get('/dashboard/leaderboard/:studentId',parentController.getLeaderboard);
router.get('/upcoming-classes/:studentId', parentController.getUpcomingClasses);
// router.post('/upload-image', parentController.uploadImage);
router.get('/profileImage/:parentId', parentController.getProfileImage);
router.post('/upload-image', parentController.uploadImage);






module.exports = router;
