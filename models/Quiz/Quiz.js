const Sequelize = require('sequelize');
const sequelize = require('../../utils/database');

const Quiz = sequelize.define('Quiz', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  title: {
    type: Sequelize.STRING,
    allowNull: false
  },
  instructions: {
    type: Sequelize.TEXT,
    allowNull: true
  },
  duration: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  passingScore: {
    type: Sequelize.FLOAT,
    allowNull: false
  }
});

module.exports = Quiz;