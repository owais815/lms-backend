const { DataTypes } = require('sequelize');
const sequelize = require('../utils/database');

const ClassSchedule = sequelize.define('ClassSchedule', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  recurrenceType: {
    type: DataTypes.ENUM('one-time', 'weekly', 'biweekly'),
    allowNull: false,
    defaultValue: 'one-time',
  },
  // JSON array of day indices: 0=Sun, 1=Mon, ..., 6=Sat
  daysOfWeek: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  startTime: {
    type: DataTypes.TIME,
    allowNull: false,
  },
  endTime: {
    type: DataTypes.TIME,
    allowNull: false,
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  // For recurring schedules — null means open-ended but we cap at 1 year in controller
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  meetingLink: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'active', 'cancelled'),
    allowNull: false,
    defaultValue: 'active',
  },
  createdBy: {
    type: DataTypes.ENUM('admin', 'teacher'),
    allowNull: false,
    defaultValue: 'admin',
  },
  courseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Courses', key: 'id' },
  },
  teacherId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Teachers', key: 'id' },
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Students', key: 'id' },
  },
  courseDetailsId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'CourseDetails', key: 'id' },
  },
}, {
  tableName: 'ClassSchedules',
  timestamps: true,
});

module.exports = ClassSchedule;
