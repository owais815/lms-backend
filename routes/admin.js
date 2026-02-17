const express = require('express');
const {body} = require('express-validator');
const adminController = require('../controllers/admin');
const Admin = require('../models/Admin');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');

const router = express.Router();

router.put('/signup',[
    body('email').isEmail().withMessage("Please enter a valid email.").custom((value,{req})=>{
        return Admin.findOne({where:{email:value}}).then(userObj=>{
            if(userObj){
                return Promise.reject("E-mail already exist.!");
            }
        })
    }).normalizeEmail(),
    // email validation ends here
    body('username').trim().isLength({min:5}).custom((value,{req})=>{
        return Admin.findOne({where:{username:value}}).then(userObj=>{
            if(userObj){
                return Promise.reject("Username already exist.!");
            }
        })
    }),
    body('password').trim().isLength({min:5}),
    body('name').trim().not().isEmpty()
],adminController.signup);


router.post('/login',adminController.login);
router.put('/update/:adminId',adminController.update);
router.delete('/:adminId',adminController.delete);
router.get('/teachers', adminController.getAllAdmins);
// router.get('/:adminId', adminController.getAdminById);
router.post('/getByUsername', adminController.getAdminByUsername);
router.post('/assignTeacher',adminController.assignTeacher);
router.post('/changeTeacherPassword',adminController.updateTeacherPasswordByUsername);
router.post('/changeStudentPassword',adminController.updateStudentPasswordByUsername);
router.post('/changeParentPassword',adminController.updateParentPasswordByUsername);

router.post('/changePassword',adminController.updatePassword
    
);

//Course CRUD
router.post('/addCourse',adminController.addCourse);
router.get('/getAllCourses',adminController.getAllCourses);
router.get('/getAllCoursesUpcoming',adminController.getAllCoursesUpcoming);

// router.get('/getCourseById/:courseId',adminController.getCourseById); getAllCoursesUpcoming
router.put('/updateCourse/:courseId',adminController.updateCourse);
router.delete('/deleteCourse/:courseId',adminController.deleteCourse);
//announcements
router.post('/announcement',adminController.createAnnouncement);
router.post('/getAnnouncements',adminController.getAnnouncements);
router.get('/getAllAnnouncements',adminController.getAllAnnouncements);
//deleteannouncement
router.delete('/deleteannouncement/:announcementId',adminController.deleteAnnouncement);

//get next four hours classes
router.get('/getNextFourHoursClasses',adminController.getNextFourHoursClasses);
// getFreeTimeSlots
router.get('/getFreeTimeSlots/:teacherId/:timeRange', adminController.getFreeTimeSlots);

//roles
router.get('/getAllRoles',adminController.getRoles);
router.post('/createRole',adminController.createRole);
router.put('/updateRole/:roleId',adminController.updateRole);
// router.post('/addRight',adminController.addRight);

//RBAC
router.post('/createAdmin', adminController.createAdmin);
router.get('/getAllAdminUsers', adminController.getAllAdminUsers);
// router.get('/admins/:id', adminController.getAdminById);
router.put('/updateAdmin/:id', adminController.updateAdmin);
router.delete('/deleteAdmin/:id', adminController.deleteAdmin);

router.post('/assign-rights', adminController.assignRightsToRole);
router.get('/rights/:roleId', adminController.getRightsByRole);
router.get('/user-rights/:roleId', adminController.getUserRights);




module.exports = router;
