const Sequelize = require('sequelize');
const sequelize = require('../../utils/database');

const Question = sequelize.define('Question', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    quizId: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    type: {
      type: Sequelize.ENUM('multiple_choice', 'true_false', 'short_answer'),
      allowNull: false
    },
    question: {
      type: Sequelize.TEXT,
      allowNull: false
    },
    options: {
      type: Sequelize.JSON,
      allowNull: true
    },
    correctAnswer: {
      type: Sequelize.STRING,
      allowNull: false
    }
  });
  module.exports = Question;