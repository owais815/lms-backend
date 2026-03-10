const { DataTypes } = require('sequelize');
const sequelize = require('../utils/database');

const Salary = sequelize.define('Salary', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  teacherId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Teachers', key: 'id' },
    onDelete: 'CASCADE',
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  month: {
    type: DataTypes.DATEONLY, // stored as first day of month e.g. 2026-03-01
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('paid', 'unpaid', 'partial'),
    allowNull: false,
    defaultValue: 'unpaid',
  },
  paidDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'Salaries',
});

module.exports = Salary;
