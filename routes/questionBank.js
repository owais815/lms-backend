const express = require('express');
const questionBankController = require('../controllers/questionBank');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

// All question bank routes require authentication
router.get('/', isAuth, questionBankController.getAllQuestions);
router.post('/', isAuth, questionBankController.createQuestion);
router.delete('/:id', isAuth, questionBankController.deleteQuestion);

module.exports = router;
