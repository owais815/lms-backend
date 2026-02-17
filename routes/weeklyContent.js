const express = require('express');
const router = express.Router();
const weeklyContentController = require('../controllers/weeklyContent');

// Upload a new resource
router.post('/upload', weeklyContentController.uploadResource);

// // Get resources for a specific student and course 
router.get('/:courseDetailId', weeklyContentController.getResources);

router.delete('/:id', weeklyContentController.deleteResource);
// //get with student Id
// router.get('/student/:studentId', weeklyContentController.getResourcesOfStudent);


// // Delete a resource
// router.delete('/:resourceId', weeklyContentController.deleteResource);

// // Serve a resource
// router.get('/:resourceId', weeklyContentController.serveResource);

// router.post('/uploadProgress', weeklyContentController.uploadProgress);


module.exports = router;