const express = require('express');
const router = express.Router();
const supportRequestController = require('../controllers/supportRequestController');

// Create a support request
router.post('/', supportRequestController.createSupportRequest);

// Get all support requests (for admin view)
router.get('/', supportRequestController.getAllSupportRequests);

// Get a single support request by ID
router.get('/:id', supportRequestController.getSupportRequestById);

// Update a support request by ID
router.put('/:id', supportRequestController.updateSupportRequest);

// Delete a support request by ID
router.delete('/:id', supportRequestController.deleteSupportRequest);

// routes/supportRequestRoutes.js
router.get('/user/:userId/:userType', supportRequestController.getSupportRequestsByUser);


module.exports = router;
