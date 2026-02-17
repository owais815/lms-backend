module.exports = {
  up: async (queryInterface, Sequelize) => {
      await queryInterface.changeColumn('Plans', 'features', {
          type: Sequelize.JSON,
          allowNull: false,
      });
  },
  down: async (queryInterface, Sequelize) => {
      await queryInterface.changeColumn('Plans', 'features', {
          type: Sequelize.STRING,
          allowNull: false,
      });
  },
};
