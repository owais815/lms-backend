const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resource');
const isAuth = require('../middleware/is-auth');

// Upload a new resource
router.post('/upload', isAuth, resourceController.uploadResource);

// Get resources for a specific student and course
router.get('/student/:studentId/course/:courseId', isAuth, resourceController.getResources);

// Get with student Id
router.get('/student/:studentId', isAuth, resourceController.getResourcesOfStudent);

// Delete a resource
router.delete('/:resourceId', isAuth, resourceController.deleteResource);

// Serve a resource
router.get('/:resourceId', isAuth, resourceController.serveResource);

router.post('/uploadProgress', isAuth, resourceController.uploadProgress);

module.exports = router;
