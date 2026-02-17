const Sequelize = require('sequelize');
const sequelize = require('../../utils/database');
const QuizAttempt = sequelize.define('QuizAttempt', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    quizId: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    studentId: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    startTime: {
      type: Sequelize.DATE,
      allowNull: false
    },
    endTime: {
      type: Sequelize.DATE,
      allowNull: true
    },
    score: {
      type: Sequelize.FLOAT,
      allowNull: true
    }
  });

  module.exports =QuizAttempt;