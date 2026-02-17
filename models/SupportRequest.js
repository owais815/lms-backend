// models/SupportRequest.js
const { DataTypes } = require('sequelize');
const sequelize = require('../utils/database'); // Your Sequelize instance
const Teacher = require('./Teacher');
const Student = require('./Student');

const SupportRequest = sequelize.define('SupportRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  problem: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  userType: {
    type: DataTypes.ENUM('student', 'teacher'),
    allowNull: false,
  },
  priority: {
    type: DataTypes.ENUM('high', 'medium', 'normal'),
    defaultValue: 'normal',
  },
  responseFromAdmin: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'resolved', 'rejected'),
    defaultValue: 'pending',
  },
});
SupportRequest.belongsTo(Student, { foreignKey: 'userId', constraints: false, as: 'student' });
SupportRequest.belongsTo(Teacher, { foreignKey: 'userId', constraints: false, as: 'teacher' });
module.exports = SupportRequest;
