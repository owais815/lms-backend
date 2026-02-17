'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Students', 'flexibleHours', {
      type: Sequelize.TIME,
      allowNull: true,
    });
    await queryInterface.addColumn('Students', 'suitableHours', {
      type: Sequelize.TIME,
      allowNull: true,
    });
    await queryInterface.addColumn('Students', 'countryName', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Students', 'state', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Students', 'city', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Students', 'timeZone', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Students', 'flexibleHours');
    await queryInterface.removeColumn('Students', 'suitableHours');
    await queryInterface.removeColumn('Students', 'countryName');
    await queryInterface.removeColumn('Students', 'state');
    await queryInterface.removeColumn('Students', 'city');
    await queryInterface.removeColumn('Students', 'timeZone');
  }
};
