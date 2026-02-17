 const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../../utils/database'); 
const Student = require('../Student');

const CourseDetails = require('../CourseDetails');
const Teacher = require('../Teacher');

const AdminFeedback = sequelize.define('AdminFeedback', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  feedback: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  //areas to improve should be ['reading','writing','speaking','listening']
  areasToImprove: {
    type: DataTypes.ENUM('Reading', 'Writing', 'Speaking', 'Listening'),
    allowNull: true,
    defaultValue: 'reading',
  },
  //progress in grades should be one of ['A','B','C','D','F']
  progressInGrades: {
    type: DataTypes.ENUM('A', 'B', 'C', 'D', 'F'),
    allowNull: false,
    defaultValue: 'A',
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Student,
      key: 'id',
    },
  },
  teacherId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Teacher,
      key: 'id',
    },
  }
}, {
  tableName: 'AdminFeedback',
  timestamps: true,
});

// Associations
AdminFeedback.belongsTo(Student, { foreignKey: 'studentId' });
AdminFeedback.belongsTo(Teacher, { foreignKey: 'teacherId' });
AdminFeedback.belongsTo(CourseDetails, { foreignKey: 'courseDetailsId' });

module.exports = AdminFeedback;



