const { DataTypes } = require('sequelize');
const sequelize = require('../utils/database');
const Student = require('./Student');
const CourseDetails = require('./CourseDetails');

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
    allowNull: false
  }
});

Attendance.belongsTo(Student, { foreignKey: 'studentId' });
Attendance.belongsTo(CourseDetails, { foreignKey: 'courseId' });

module.exports = Attendance;