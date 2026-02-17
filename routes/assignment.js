const express = require('express');
const {body} = require('express-validator');
const assignmentController = require('../controllers/assignment');

const router = express.Router();
//when teacher creates assignment
router.post('/create',  assignmentController.createAssignment);
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
