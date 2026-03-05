const express = require('express');
const router = express.Router();
const adminFeedback = require('../controllers/adminfeedback');
const isAuth = require('../middleware/is-auth');

router.post('/add',                                    isAuth, adminFeedback.addFeedback);
router.get('/student/:studentId',                      isAuth, adminFeedback.getFeedback);
router.get('/student/:studentId/teacherFeedback',      isAuth, adminFeedback.getTeacherFeedbacks);
router.get('/getAllFeedbacks',                          isAuth, adminFeedback.getAllFeedbacks);
router.delete('/:feedbackId',                          isAuth, adminFeedback.deleteFeedback);

module.exports = router;
