const Sequelize = require('sequelize');
const sequelize = require('../utils/database');
const Student = require('./Student');
const CourseDetails = require('./CourseDetails');

const Resource = sequelize.define('Resource', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true
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
  uploadedBy: {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: {
      model: 'Teachers',
      key: 'id'
    }
  }
});

Resource.belongsTo(Student, { foreignKey: 'studentId' });
Resource.belongsTo(CourseDetails, { foreignKey: 'courseId' });

module.exports = Resource;