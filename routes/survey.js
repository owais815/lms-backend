const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/survey');
const isAuth = require('../middleware/is-auth');

router.post('/submit',                              isAuth, surveyController.submitSurvey);
router.get('/pending/:studentId/:classId',          isAuth, surveyController.checkPendingSurvey);
router.get('/progress/:studentId',                  isAuth, surveyController.getStudentSurveys);

// Dashboard stats routes (admin/teacher)
router.get('/stats/:teacherId?',                    isAuth, surveyController.getDashboardStats);
router.get('/distribution/:teacherId?',             isAuth, surveyController.getRatingDistribution);
router.get('/trend/:teacherId?',                    isAuth, surveyController.getRatingTrend);
router.get('/feedback/:teacherId?/:page?/:limit?',  isAuth, surveyController.getRecentFeedback);

module.exports = router;
