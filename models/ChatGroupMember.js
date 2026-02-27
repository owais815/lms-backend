const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const ChatGroupMember = sequelize.define('ChatGroupMember', {
  id:       { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  groupId:  { type: Sequelize.INTEGER, allowNull: false },
  userId:   { type: Sequelize.INTEGER, allowNull: false },
  userType: { type: Sequelize.STRING,  allowNull: false },
  canSend:  { type: Sequelize.BOOLEAN, defaultValue: true },
});

module.exports = ChatGroupMember;
