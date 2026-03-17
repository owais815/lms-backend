const express = require('express');
const quizController = require('../controllers/quiz');
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// ─── Teacher-facing routes ────────────────────────────────────────────────────
router.post('/quizzes',                                isAuth, quizController.createQuiz);
router.put('/assign',                                  isAuth, quizController.assignCourseAndStudentToQuiz);
router.post('/quizzes/:quizId/questions',              isAuth, quizController.AddQuestionToQuiz);
router.get('/quizzes/:quizId',                         isAuth, quizController.getQuizWithQuestion);
router.get('/quizzesByTeacher/:teacherId',             isAuth, quizController.getQuizWithTeachers);
router.delete('/quizzes/:quizId',                      isAuth, quizController.deleteQuiz);
router.delete('/quizGroup/:quizId',                    isAuth, quizController.deleteQuizGroup);
router.delete('/quizzes/questions/:questionId',        isAuth, quizController.deleteQuestion);
router.put('/update/:quizId',                          isAuth, quizController.updateQuizGroup);

// ─── Student-facing routes ───────────────────────────────────────────────────
router.post('/quiz-attempts',                          isAuth, quizController.startQuizAttempt);
router.put('/quiz-attempts/:attemptId',               isAuth, quizController.submitQuizAttempt);
router.get('/student/:studentId/quizzes',              isAuth, quizController.getStudentQuizzes);
router.get('/student/:studentId/quiz-attempts/:quizId', isAuth, quizController.checkIfStudentHasAttemptedQuiz);

// ─── Admin-only routes ───────────────────────────────────────────────────────
router.post('/approve/:quizId',  isAuth, checkPermission(PERMISSIONS.QUIZZES_APPROVE), quizController.approveQuizGroup);
router.post('/reject/:quizId',   isAuth, checkPermission(PERMISSIONS.QUIZZES_APPROVE), quizController.rejectQuizGroup);
router.get('/admin/all',         isAuth, checkPermission(PERMISSIONS.QUIZZES_VIEW),    quizController.getAllQuizzesAdmin);

// Get enrolled students for quiz creation (filter students)
router.get('/enrolled-students', isAuth, quizController.getEnrolledStudents);

// Quiz results
router.get('/results/admin',             isAuth, checkPermission(PERMISSIONS.QUIZZES_VIEW), quizController.getAdminQuizResults);
router.get('/results/teacher/:teacherId', isAuth, quizController.getTeacherQuizResults);
router.get('/results/student/:studentId', isAuth, quizController.getStudentQuizResults);

module.exports = router;
