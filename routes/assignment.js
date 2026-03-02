const express = require('express');
const assignmentController = require('../controllers/assignment');
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// ─── Teacher-facing routes ────────────────────────────────────────────────────
router.post('/create',                                      isAuth, assignmentController.createAssignment);
router.put('/update/:assignmentId',                         isAuth, assignmentController.updateAssignment);
router.get('/teacher/:teacherId',                           isAuth, assignmentController.getTeacherAssignments);
router.get('/allAssignments/:teacherId',                    isAuth, assignmentController.getAllAssignmentsTeacher);
router.post('/grade',                                       isAuth, assignmentController.gradeAssignment);
router.delete('/:assignmentId',                             isAuth, assignmentController.deleteAssignmentFile);
router.delete('/submittedAssignment/:submittedAssignmentId', isAuth, assignmentController.deleteSubmittedAssignmentFile);

// ─── Student-facing routes ───────────────────────────────────────────────────
router.post('/submit',                                      isAuth, assignmentController.submitAssignment);
router.get('/student/:studentId',                           isAuth, assignmentController.getStudentAssignments);

// ─── Admin-only routes ───────────────────────────────────────────────────────
router.post('/approve/:id',  isAuth, checkPermission(PERMISSIONS.ASSIGNMENTS_APPROVE), assignmentController.approveAssignment);
router.post('/reject/:id',   isAuth, checkPermission(PERMISSIONS.ASSIGNMENTS_APPROVE), assignmentController.rejectAssignment);
router.get('/admin/all',     isAuth, checkPermission(PERMISSIONS.ASSIGNMENTS_VIEW),    assignmentController.getAllAssignmentsAdmin);

module.exports = router;
