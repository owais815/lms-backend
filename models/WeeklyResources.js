// models/WeeklyContent.js
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../utils/database');
const WeeklyContent = require('./WeeklyContent');

const WeeklyResource = sequelize.define('WeeklyResource', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    weeklyContentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: WeeklyContent,
            key: 'id'
        }
    },
    fileName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      fileType: {
        type: Sequelize.STRING,
        allowNull: false
      },
      filePath: {
        type: Sequelize.STRING,
        allowNull: false
      },
});


module.exports = WeeklyResource;
