const { DataTypes } = require('sequelize');
const sequelize = require('../utils/database');

const Attendance = sequelize.define('Attendance', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('Present', 'Absent'),
    allowNull: false,
    defaultValue: 'Present'
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Students', key: 'id' }
  },
  courseDetailsId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'CourseDetails', key: 'id' }
  },
  sessionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'ClassSessions', key: 'id' }
  }
});

// Associations are defined in models/association.js

module.exports = Attendance;
