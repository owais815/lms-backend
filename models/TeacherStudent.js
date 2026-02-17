const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const TeacherStudent = sequelize.define('TeacherStudent', {
    TeacherId: {
        type: Sequelize.INTEGER,
        references: {
            model: 'Teachers',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    StudentId: {
        type: Sequelize.INTEGER,
        references: {
            model: 'Students',
            key: 'id'
        },
        onDelete: 'CASCADE'
    }
});

module.exports = TeacherStudent;
