const express = require('express');
const router = express.Router();
const adminFeedback = require('../controllers/adminfeedback');

router.post('/add', adminFeedback.addFeedback);

router.get('/student/:studentId', adminFeedback.getFeedback);
router.get('/student/:studentId/teacherFeedback', adminFeedback.getTeacherFeedbacks);
router.get('/getAllFeedbacks', adminFeedback.getAllFeedbacks);


router.delete('/:feedbackId', adminFeedback.deleteFeedback);

module.exports = router;
