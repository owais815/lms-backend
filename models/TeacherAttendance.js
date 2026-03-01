const { DataTypes } = require('sequelize');
const sequelize = require('../utils/database');

const TeacherAttendance = sequelize.define('TeacherAttendance', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  teacherId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Teachers', key: 'id' }
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  checkInTime: {
    type: DataTypes.TIME,
    allowNull: true
  },
  checkOutTime: {
    type: DataTypes.TIME,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('Present', 'Absent'),
    allowNull: false,
    defaultValue: 'Absent'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
});

// Associations are defined in models/association.js

module.exports = TeacherAttendance;
