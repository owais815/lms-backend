const QuestionBank = require('../models/QuestionBank');

exports.getAllQuestions = async (req, res, next) => {
  try {
    const questions = await QuestionBank.findAll({
      order: [['createdAt', 'DESC']],
    });
    res.status(200).json({ questions });
  } catch (error) {
    next(error);
  }
};

exports.createQuestion = async (req, res, next) => {
  try {
    const { type, question, options, correctAnswer, subject, createdBy } = req.body;
    const entry = await QuestionBank.create({
      type,
      question,
      options: options || null,
      correctAnswer,
      subject: subject || null,
      createdBy: createdBy || null,
    });
    res.status(201).json({ message: 'Question saved to bank', question: entry });
  } catch (error) {
    next(error);
  }
};

exports.deleteQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await QuestionBank.destroy({ where: { id } });
    if (result === 0) {
      return res.status(404).json({ message: 'Question not found' });
    }
    res.status(200).json({ message: 'Question deleted from bank' });
  } catch (error) {
    next(error);
  }
};
