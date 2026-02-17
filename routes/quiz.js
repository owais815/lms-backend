const express = require('express');
const {body} = require('express-validator');
const quizController = require('../controllers/quiz');

const router = express.Router();

// Create a new quiz
router.post('/quizzes',quizController.createQuiz);

//Assign Quiz to student
router.put('/assign',quizController.assignCourseAndStudentToQuiz);

  
  // Add a question to a quiz
  router.post('/quizzes/:quizId/questions',quizController.AddQuestionToQuiz);
  
  // Get a quiz with its questions
  router.get('/quizzes/:quizId', quizController.getQuizWithQuestion);
  
   // Get a quiz with teacher Id
   router.get('/quizzesByTeacher/:teacherId', quizController.getQuizWithTeachers);

  // Start a quiz attempt
  router.post('/quiz-attempts', quizController.startQuizAttempt);
  
  // Submit a quiz attempt
  router.put('/quiz-attempts/:attemptId', quizController.submitQuizAttempt);

  //delete a quiz
  router.delete('/quizzes/:quizId',quizController.deleteQuiz);

  //delete a question
  router.delete('/quizzes/questions/:questionId',quizController.deleteQuestion);

  //get quizes for student
  router.get('/student/:studentId/quizzes', quizController.getStudentQuizzes);

  //check if a student has attempted a quiz
  router.get('/student/:studentId/quiz-attempts/:quizId', quizController.checkIfStudentHasAttemptedQuiz);

module.exports = router;
