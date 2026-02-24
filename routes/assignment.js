const express = require('express');
const {body} = require('express-validator');
const assignmentController = require('../controllers/assignment');

const router = express.Router();
//when teacher creates assignment
router.post('/create',  assignmentController.createAssignment);
//update an existing assignment
router.put('/update/:assignmentId', assignmentController.updateAssignment);
//approve a pending assignment (admin only)
router.post('/approve/:id', assignmentController.approveAssignment);
//reject a pending assignment (admin only)
router.post('/reject/:id', assignmentController.rejectAssignment);
//get all assignments for admin view
router.get('/admin/all', assignmentController.getAllAssignmentsAdmin);
//submit assignment(when student submits his/her assignment)
router.post('/submit',  assignmentController.submitAssignment);
//assign grade to student for specific assignment
router.post('/grade',  assignmentController.gradeAssignment);
//get assignments that are assigned to student
router.get('/student/:studentId',  assignmentController.getStudentAssignments);
//get only assignments that are submitted to teacher
router.get('/teacher/:teacherId',  assignmentController.getTeacherAssignments);
//get All Assignments assigned to teacher
router.get('/allAssignments/:teacherId',  assignmentController.getAllAssignmentsTeacher);
//delete assignment that teacher created
router.delete('/:assignmentId',assignmentController.deleteAssignmentFile);
//delete submitted assignments(that student submits & teacher graded already)
router.delete('/submittedAssignment/:submittedAssignmentId',assignmentController.deleteSubmittedAssignmentFile);

module.exports = router;
