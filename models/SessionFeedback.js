const { DataTypes } = require('sequelize');
const sequelize = require('../utils/database');

const SessionFeedback = sequelize.define('SessionFeedback', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  sessionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'ClassSessions', key: 'id' },
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Students', key: 'id' },
  },
  // Category ratings (1–5)
  teachingQuality: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    validate: { min: 1, max: 5 },
  },
  contentClarity: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    validate: { min: 1, max: 5 },
  },
  sessionPace: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    validate: { min: 1, max: 5 },
  },
  engagement: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    validate: { min: 1, max: 5 },
  },
  overallRating: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    validate: { min: 1, max: 5 },
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

// Associations defined in models/association.js

module.exports = SessionFeedback;
