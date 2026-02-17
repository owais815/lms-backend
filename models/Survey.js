const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../utils/database'); 
const Student = require('./Student');
const Teacher = require('./Teacher');
const UpcomingClass = require('./UpcomingClasses');

const Survey = sequelize.define('Survey', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  classRating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  lessonRating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  teacherRating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  teacherId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Teacher, 
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
  classId:{
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: UpcomingClass,
      key: 'id',
    },
  }
}, {
  tableName: 'Survey',
  timestamps: true,
});

// Associations
Survey.belongsTo(Student, { foreignKey: 'studentId' });
Survey.belongsTo(UpcomingClass, { foreignKey: 'classId',onDelete: 'CASCADE'  });
Survey.belongsTo(Teacher, { foreignKey: 'teacherId' });

module.exports = Survey;



