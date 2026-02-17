const Sequelize = require('sequelize');
const sequelize = require('../utils/database');

const StudentFeedback = sequelize.define('StudentFeedback', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    feedback: {
        type: Sequelize.TEXT,
        allowNull: false
    },
    rating: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: { min: 1, max: 5 }
    },
    responded: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
    }
});

module.exports = StudentFeedback;