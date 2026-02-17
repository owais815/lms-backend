const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/survey');

router.post('/submit', surveyController.submitSurvey);
router.get('/pending/:studentId/:classId', surveyController.checkPendingSurvey);
router.get('/progress/:studentId', surveyController.getStudentSurveys);

//dashboard routes
router.get('/stats/:teacherId?',surveyController.getDashboardStats);
router.get('/distribution/:teacherId?',surveyController.getRatingDistribution);
router.get('/trend/:teacherId?',surveyController.getRatingTrend);
router.get('/feedback/:teacherId?/:page?/:limit?',surveyController.getRecentFeedback);

module.exports = router;
