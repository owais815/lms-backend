const express = require('express');
const { body } = require('express-validator');
const adminController = require('../controllers/admin');
const Admin = require('../models/Admin');
const isAuth = require('../middleware/is-auth');
const { loginRateLimiter } = require('../middleware/rateLimiter');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// ─── Public routes (no auth required) ───────────────────────────────────────

router.put('/signup', [
  body('email').isEmail().withMessage('Please enter a valid email.').custom((value) => {
    return Admin.findOne({ where: { email: value } }).then(userObj => {
      if (userObj) return Promise.reject('E-mail already exist.!');
    });
  }).normalizeEmail(),
  body('username').trim().isLength({ min: 5 }).custom((value) => {
    return Admin.findOne({ where: { username: value } }).then(userObj => {
      if (userObj) return Promise.reject('Username already exist.!');
    });
  }),
  body('password').trim().isLength({ min: 5 }),
  body('name').trim().not().isEmpty(),
], adminController.signup);

router.post('/login', loginRateLimiter, adminController.login);

// ─── Protected routes ────────────────────────────────────────────────────────

// Admin profile management
router.put('/update/:adminId',     isAuth, adminController.update);
router.delete('/:adminId',         isAuth, adminController.delete);
router.get('/teachers',            isAuth, adminController.getAllAdmins);
router.post('/getByUsername',      isAuth, adminController.getAdminByUsername);

// Password management (admin-only, full admins bypass, sub-admins need students/teachers/parents:edit)
router.post('/changePassword',         isAuth, adminController.updatePassword);
router.post('/changeTeacherPassword',  isAuth, checkPermission(PERMISSIONS.TEACHERS_EDIT), adminController.updateTeacherPasswordByUsername);
router.post('/changeStudentPassword',  isAuth, checkPermission(PERMISSIONS.STUDENTS_EDIT), adminController.updateStudentPasswordByUsername);
router.post('/changeParentPassword',   isAuth, checkPermission(PERMISSIONS.PARENTS_EDIT),  adminController.updateParentPasswordByUsername);

// Teacher assignment
router.post('/assignTeacher', isAuth, checkPermission(PERMISSIONS.TEACHERS_EDIT), adminController.assignTeacher);

// Course CRUD
router.post('/addCourse',                    isAuth, checkPermission(PERMISSIONS.COURSES_CREATE), adminController.addCourse);
router.get('/getAllCourses',                  isAuth, checkPermission(PERMISSIONS.COURSES_VIEW),   adminController.getAllCourses);
router.get('/getAllCoursesUpcoming',          isAuth, checkPermission(PERMISSIONS.COURSES_VIEW),   adminController.getAllCoursesUpcoming);
router.put('/updateCourse/:courseId',        isAuth, checkPermission(PERMISSIONS.COURSES_EDIT),   adminController.updateCourse);
router.delete('/deleteCourse/:courseId',     isAuth, checkPermission(PERMISSIONS.COURSES_DELETE), adminController.deleteCourse);

// Announcements
router.post('/announcement',                       isAuth, checkPermission(PERMISSIONS.ANNOUNCEMENTS_CREATE), adminController.createAnnouncement);
router.post('/getAnnouncements',                   isAuth, checkPermission(PERMISSIONS.ANNOUNCEMENTS_VIEW),   adminController.getAnnouncements);
router.get('/getAllAnnouncements',                  isAuth, checkPermission(PERMISSIONS.ANNOUNCEMENTS_VIEW),   adminController.getAllAnnouncements);
router.delete('/deleteannouncement/:announcementId', isAuth, checkPermission(PERMISSIONS.ANNOUNCEMENTS_DELETE), adminController.deleteAnnouncement);

// Class scheduling
router.get('/getNextFourHoursClasses',                 isAuth, checkPermission(PERMISSIONS.SCHEDULE_VIEW),   adminController.getNextFourHoursClasses);
router.get('/getFreeTimeSlots/:teacherId/:timeRange',   isAuth, checkPermission(PERMISSIONS.SCHEDULE_VIEW),   adminController.getFreeTimeSlots);

// Role management (roles:view / roles:manage)
router.get('/getAllRoles',          isAuth, checkPermission(PERMISSIONS.ROLES_VIEW),   adminController.getRoles);
router.post('/createRole',         isAuth, checkPermission(PERMISSIONS.ROLES_MANAGE), adminController.createRole);
router.put('/updateRole/:roleId',  isAuth, checkPermission(PERMISSIONS.ROLES_MANAGE), adminController.updateRole);
router.delete('/role/:roleId',     isAuth, checkPermission(PERMISSIONS.ROLES_MANAGE), adminController.deleteRole);

// Admin user management
router.post('/createAdmin',        isAuth, checkPermission(PERMISSIONS.ROLES_MANAGE), adminController.createAdmin);
router.get('/getAllAdminUsers',     isAuth, checkPermission(PERMISSIONS.ROLES_VIEW),   adminController.getAllAdminUsers);
router.put('/updateAdmin/:id',     isAuth, checkPermission(PERMISSIONS.ROLES_MANAGE), adminController.updateAdmin);
router.delete('/deleteAdmin/:id',  isAuth, checkPermission(PERMISSIONS.ROLES_MANAGE), adminController.deleteAdmin);

// Dashboard stats
router.get('/dashboard-stats', isAuth, adminController.getDashboardStats);

// Rights / permissions assignment
router.post('/assign-rights',       isAuth, checkPermission(PERMISSIONS.ROLES_MANAGE), adminController.assignRightsToRole);
router.get('/rights/:roleId',       isAuth, checkPermission(PERMISSIONS.ROLES_VIEW),   adminController.getRightsByRole);
router.get('/user-rights/:roleId',  isAuth, adminController.getUserRights);

module.exports = router;
