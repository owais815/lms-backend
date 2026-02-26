const { DataTypes } = require('sequelize');
const sequelize = require('../utils/database');

const ClassSession = sequelize.define('ClassSession', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  // FK to ClassSchedule — null for standalone one-off sessions
  scheduleId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'ClassSchedules', key: 'id' },
    onDelete: 'CASCADE',
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  startTime: {
    type: DataTypes.TIME,
    allowNull: false,
  },
  endTime: {
    type: DataTypes.TIME,
    allowNull: false,
  },
  // Overrides the schedule's meeting link if set
  meetingLink: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'completed', 'cancelled', 'makeup'),
    allowNull: false,
    defaultValue: 'scheduled',
  },
  cancellationReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
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
  // Unique room ID used by the calling-app (e.g. 'lms-42')
  roomId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  // Live-call lifecycle — separate from session attendance status
  sessionStatus: {
    type: DataTypes.ENUM('idle', 'live', 'ended'),
    allowNull: false,
    defaultValue: 'idle',
  },
}, {
  tableName: 'ClassSessions',
  timestamps: true,
});

module.exports = ClassSession;
