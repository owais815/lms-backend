 const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../../utils/database'); 
const Student = require('../Student');
const Resource = require('../Resource');

const CourseDetails = require('../CourseDetails');

const MyBookmark = sequelize.define('MyBookmark', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  resourceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Resource, 
      key: 'id',
    },
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Student,
      key: 'id',
    },
  },
  courseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: CourseDetails,
      key: 'id',
    },
  },
  isBookmarked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'MyBookmarks',
  timestamps: true,
});

// Associations
MyBookmark.belongsTo(Student, { foreignKey: 'studentId' });
MyBookmark.belongsTo(CourseDetails, { foreignKey: 'courseId' });
MyBookmark.belongsTo(Resource, { foreignKey: 'resourceId' });

module.exports = MyBookmark;



