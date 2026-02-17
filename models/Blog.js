const Sequelize = require("sequelize");
const sequelize = require("../utils/database");

const Blog = sequelize.define("Blog", {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  title: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  content: {
    type: Sequelize.TEXT,
    allowNull: false,
  },
  author: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  publishedDate: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  tags: {
    type: Sequelize.JSON,
    allowNull:true
  },
  imageUrl: {
    type: Sequelize.STRING,
    allowNull: true
}
});

module.exports = Blog;
