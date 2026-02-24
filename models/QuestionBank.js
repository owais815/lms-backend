const { DataTypes } = require('sequelize');
const sequelize = require('../utils/database');

const QuestionBank = sequelize.define('QuestionBank', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  type: {
    type: DataTypes.ENUM('multiple_choice', 'true_false', 'short_answer'),
    allowNull: false,
  },
  question: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  options: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  correctAnswer: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
});

module.exports = QuestionBank;
