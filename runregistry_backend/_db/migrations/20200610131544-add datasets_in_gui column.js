'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('DatasetEvent', 'datasets_in_gui', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      }),
      queryInterface.addColumn('Dataset', 'datasets_in_gui', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      }),
    ]);
  },

  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('DatasetEvent', 'datasets_in_gui'),
      queryInterface.removeColumn('Dataset', 'datasets_in_gui'),
    ]);
  },
};
