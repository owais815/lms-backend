const express = require('express');
const router = express.Router();
const faqController = require('../controllers/faqController');
const isAuth = require('../middleware/is-auth');

// Public — students & teachers view published FAQs
router.get('/', faqController.getPublishedFAQs);

// Admin only routes
router.get('/all', isAuth, faqController.getAllFAQs);
router.post('/', isAuth, faqController.createFAQ);
router.put('/:id', isAuth, faqController.updateFAQ);
router.delete('/:id', isAuth, faqController.deleteFAQ);

module.exports = router;
