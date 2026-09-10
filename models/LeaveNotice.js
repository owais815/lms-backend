const { DataTypes } = require('sequelize');
const sequelize = require('../utils/database');

const LeaveNotice = sequelize.define('LeaveNotice', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  personId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  personType: {
    type: DataTypes.ENUM('teacher', 'student'),
    allowNull: false,
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: true, // null = single-day leave
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  createdById: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Admins', key: 'id' },
    onDelete: 'SET NULL',
  },
});

module.exports = LeaveNotice;
