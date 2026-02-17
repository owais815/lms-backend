const Sequelize = require('sequelize');
const sequelize = require('../utils/database');
const Courses = require('./Course');

const UpcomingCourses = sequelize.define('UpcomingCourse', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    teacherId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
            model: 'Teachers',
            key: 'id'
        }
    },
    studentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
            model: 'Students',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    courseId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'Courses',
            key: 'id'
        }
    },
    startingFrom: {
        type: Sequelize.DATE,
        allowNull: true
    },
    isStarted:{
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false
    }
});

UpcomingCourses.belongsTo(Courses, { foreignKey: 'courseId' });
module.exports = UpcomingCourses;
