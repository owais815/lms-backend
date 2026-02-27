const Sequelize = require("sequelize");
const sequelize = require("../utils/database");

const ChatMessage = sequelize.define("ChatMessage", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  message: {
    type: Sequelize.TEXT,
    allowNull: false,
  },
  senderId: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  senderType: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  receiverId: {
    type: Sequelize.INTEGER,
    allowNull: true,
  },
  receiverType: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  isPrivate: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
  },
  messageType: {
    type: Sequelize.ENUM('text', 'voice'),
    defaultValue: 'text',
  },
  mediaUrl: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  mediaDuration: {
    type: Sequelize.FLOAT,
    allowNull: true,
  },
  preDeletionNotified: {
    type: Sequelize.BOOLEAN,
    defaultValue: false,
  },
});

module.exports = ChatMessage;
