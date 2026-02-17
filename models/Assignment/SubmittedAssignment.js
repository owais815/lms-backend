const { DataTypes } = require('sequelize');
const sequelize = require('../../utils/database');

const SubmittedAssignment = sequelize.define('SubmittedAssignment', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  fileUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  submissionDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  score: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('Not Started', 'In Progress', 'Submitted', 'Graded'),
    allowNull: false,
    defaultValue: 'Not Started'
  }
});

module.exports = SubmittedAssignment;