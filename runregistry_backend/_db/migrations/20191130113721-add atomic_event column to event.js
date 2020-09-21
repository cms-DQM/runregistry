'use strict';

module.exports = {
    up: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.addColumn('Event', 'atomic_version', {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 50000000,
                references: {
                    model: 'Version',
                    key: 'atomic_version'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            })
        ]);
    },

    down: (queryInterface, Sequelize) => {
        return Promise.all([
            queryInterface.removeColumn('Event', 'atomic_version')
        ]);
    }
};
