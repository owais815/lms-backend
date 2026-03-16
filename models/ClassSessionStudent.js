const { DataTypes } = require('sequelize');
const sequelize = require('../utils/database');

const ClassSessionStudent = sequelize.define('ClassSessionStudent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  sessionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'ClassSessions', key: 'id' },
    onDelete: 'CASCADE',
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Students', key: 'id' },
    onDelete: 'CASCADE',
  },
}, {
  tableName: 'ClassSessionStudents',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['sessionId', 'studentId'] },
  ],
});

module.exports = ClassSessionStudent;
