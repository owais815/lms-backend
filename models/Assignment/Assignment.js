const { DataTypes } = require('sequelize');
const sequelize = require('../../utils/database');

const Assignment = sequelize.define('Assignment', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    dueDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    fileUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    maxScore: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'rejected'),
      defaultValue: 'active'
    },
    // Set when the due-soon reminder goes out; nulled when dueDate changes.
    dueReminderSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    }
  });

module.exports = Assignment;