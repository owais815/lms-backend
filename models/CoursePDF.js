'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../utils/database');

const CoursePDF = sequelize.define('CoursePDF', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  courseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  originalName: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  filePath: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
}, {
  tableName: 'CoursePDFs',
  timestamps: true,
});

module.exports = CoursePDF;
