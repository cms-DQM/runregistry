'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('Cycle', 'cycle_name', {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: true,
      }),
    ]);
  },

  down: (queryInterface, Sequelize) => {
    return Promise.all([queryInterface.removeColumn('Cycle', 'cycle_name')]);
  },
};
