const express = require('express');
const questionBankController = require('../controllers/questionBank');

const router = express.Router();

// Get all questions in the bank (global/shared)
router.get('/', questionBankController.getAllQuestions);

// Add a question to the bank
router.post('/', questionBankController.createQuestion);

// Delete a question from the bank
router.delete('/:id', questionBankController.deleteQuestion);

module.exports = router;
