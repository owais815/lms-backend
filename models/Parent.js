const Sequelize = require('sequelize');
const sequelize = require('../utils/database');
const Student = require('./Student');

const Parent = sequelize.define('Parent', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    firstName: {
        type: Sequelize.STRING,
        allowNull: false
    },
    lastName: {
        type: Sequelize.STRING,
        allowNull: true
    },
    username: {
        type: Sequelize.STRING,
        allowNull: false
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false
    },
    contact: {
        type: Sequelize.STRING,
        allowNull: true
    },
    address: {
        type: Sequelize.STRING,
        allowNull: true
    },
    email: {
        type: Sequelize.STRING,
        allowNull: true
    },
    emergencyContact: {
        type: Sequelize.STRING,
        allowNull: true
    },
    //newly added field
    profileImg: {
        type: Sequelize.STRING,
        allowNull: true
    },
});
// One parent → many students (parentId lives on Student table)
Parent.hasMany(Student, { foreignKey: 'parentId', as: 'students' });
Student.belongsTo(Parent, { foreignKey: 'parentId', as: 'parent' });

module.exports = Parent;
