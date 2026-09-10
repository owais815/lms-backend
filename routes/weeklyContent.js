const express = require('express');
const router = express.Router();
const weeklyContentController = require('../controllers/weeklyContent');
const isAuth = require('../middleware/is-auth');

router.post('/upload',                    isAuth, weeklyContentController.uploadResource);
// Must come before the generic '/:courseDetailId' GET below.
router.get('/pending-review',             isAuth, weeklyContentController.getPendingReview);
router.put('/:weeklyContentId/review',    isAuth, weeklyContentController.reviewContent);
router.get('/:courseDetailId',            isAuth, weeklyContentController.getResources);
router.delete('/:id',                     isAuth, weeklyContentController.deleteResource);

module.exports = router;
