'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove the courseId field since courseDetailsId already exists
    await queryInterface.removeColumn('AdminFeedback', 'courseId');
  },

  down: async (queryInterface, Sequelize) => {
    // Revert the change by adding the courseId column back
    await queryInterface.addColumn('AdminFeedback', 'courseId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'CourseDetails', // References the CourseDetails table
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  }
};
