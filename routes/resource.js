const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resource');
const resourceUpload = require('../middleware/resource-upload'); // Create this middleware

// Upload a new resource
router.post('/upload', resourceController.uploadResource);

// Get resources for a specific student and course 
router.get('/student/:studentId/course/:courseId', resourceController.getResources);

//get with student Id
router.get('/student/:studentId', resourceController.getResourcesOfStudent);


// Delete a resource
router.delete('/:resourceId', resourceController.deleteResource);

// Serve a resource
router.get('/:resourceId', resourceController.serveResource);

router.post('/uploadProgress', resourceController.uploadProgress);


module.exports = router;