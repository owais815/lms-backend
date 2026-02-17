// models/EnrolledStudents.j

  const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const EnrolledStudents = sequelize.define('EnrolledStudent', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    studentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Students", // name of Target model
          key: "id", // key in Target model that we're referencing
        },
      },
      courseId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Courses", // name of Target model
          key: "id", // key in Target model that we're referencing
        },
      },
});
module.exports = EnrolledStudents;
