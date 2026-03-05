const Sequelize = require('sequelize');
const sequelize = require('../utils/database');
const CourseDetails = require('./CourseDetails');
const TeacherQualification = require('./TeacherQualifications');
const Specialization = require('./TeacherSpecialization');

const Teacher = sequelize.define('Teacher', {
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
        allowNull: false
    },
    email: {
        type: Sequelize.STRING,
        allowNull: false
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
        allowNull: false
    },
    cnic: {
        type: Sequelize.STRING,
        allowNull: false
    },
    imageUrl: {
        type: Sequelize.STRING,
        allowNull: true
    },
    canDirectlyPublish: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
    },
    shift: {
        type: Sequelize.TEXT,
        allowNull: true,
        defaultValue: null,
        get() {
            const raw = this.getDataValue('shift');
            if (!raw) return null;
            try { return JSON.parse(raw); } catch { return null; }
        },
        set(val) {
            if (!val || (Array.isArray(val) && val.length === 0)) {
                this.setDataValue('shift', null);
            } else {
                this.setDataValue('shift', JSON.stringify(val));
            }
        }
    }
});

Teacher.hasMany(CourseDetails, { foreignKey: 'teacherId' });
Teacher.hasMany(TeacherQualification, { foreignKey: 'teacherId' });
Teacher.hasMany(Specialization, { foreignKey: 'teacherId' });

module.exports = Teacher;
