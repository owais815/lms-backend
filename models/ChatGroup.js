const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const ChatGroup = sequelize.define('ChatGroup', {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: Sequelize.STRING, allowNull: false },
  createdBy: { type: Sequelize.INTEGER, allowNull: false },
  createdByType: { type: Sequelize.STRING, defaultValue: 'admin' },
});

module.exports = ChatGroup;
