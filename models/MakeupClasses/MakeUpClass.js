const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../../utils/database'); 
const Student = require('../Student');
const CourseDetails = require('../CourseDetails');
const Teacher = require('../Teacher');

const MakeUpClass = sequelize.define('MakeUpClass', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  reason: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  adminReason: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
    allowNull: false,
    defaultValue: 'Pending',
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
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
},
time: {
    type: DataTypes.TIME,
    allowNull: false
},
}, {
  tableName: 'MakeUpClass',
  timestamps: true,
});

// Associations
MakeUpClass.belongsTo(Student, { foreignKey: 'studentId' });
MakeUpClass.belongsTo(CourseDetails, { foreignKey: 'courseDetailsId' });
MakeUpClass.belongsTo(Teacher, { foreignKey: 'teacherId' });

module.exports = MakeUpClass;



