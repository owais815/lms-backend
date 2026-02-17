'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Courses', 'price', {
      type: Sequelize.FLOAT,
      allowNull: true
    });

    await queryInterface.addColumn('Courses', 'isComing', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Courses', 'price');
    await queryInterface.removeColumn('Courses', 'isComing');
  }
};
