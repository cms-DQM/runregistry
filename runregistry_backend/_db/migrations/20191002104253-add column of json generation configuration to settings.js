'use strict';

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface
            .addColumn('Settings', 'JCL_id', {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 1,
                references: {
                    model: 'JsonClassifierList',
                    key: 'id'
                },
                onUpdate: 'RESTRICT',
                onDelete: 'RESTRICT'
            })
            .then(result => {
                // We remove the default '1' as value, since we want no default:
                return queryInterface.changeColumn('Settings', 'JCL_id', {
                    type: Sequelize.INTEGER,
                    defaultValue: null,
                    allowNull: false
                });
            });
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn('Settings', 'JCL_id');
    }
};
