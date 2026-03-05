const express = require('express');
const router = express.Router();
const supportRequestController = require('../controllers/supportRequestController');
const isAuth = require('../middleware/is-auth');

// Create a support request
router.post('/', isAuth, supportRequestController.createSupportRequest);

// Get all support requests (admin view)
router.get('/', isAuth, supportRequestController.getAllSupportRequests);

// Get a single support request by ID
router.get('/:id', isAuth, supportRequestController.getSupportRequestById);

// Update a support request by ID
router.put('/:id', isAuth, supportRequestController.updateSupportRequest);

// Delete a support request by ID
router.delete('/:id', isAuth, supportRequestController.deleteSupportRequest);

// Get requests by user
router.get('/user/:userId/:userType', isAuth, supportRequestController.getSupportRequestsByUser);

module.exports = router;
