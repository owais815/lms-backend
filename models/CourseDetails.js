const Sequelize = require('sequelize');
const sequelize = require('../utils/database');
const Teacher = require('./Teacher');
const Student = require('./Student');
const Courses = require('./Course');

const CourseDetails = sequelize.define('CourseDetails', {
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
        allowNull: false,
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
    // Enrollment start — used to compute the "current" lesson week.
    startDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        defaultValue: () => new Date().toISOString().split('T')[0],
    },
    status: {
        type: Sequelize.ENUM('active', 'completed'),
        allowNull: false,
        defaultValue: 'active',
    },
});

CourseDetails.belongsTo(Courses, { foreignKey: 'courseId' });
module.exports = CourseDetails;
