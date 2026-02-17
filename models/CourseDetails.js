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
    }
});

CourseDetails.belongsTo(Courses, { foreignKey: 'courseId' });
module.exports = CourseDetails;
