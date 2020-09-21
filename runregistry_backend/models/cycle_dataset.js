module.exports = (sequelize, DataTypes) => {
    const CycleDataset = sequelize.define(
        'CycleDataset',
        {
            id_cycle: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true
            },
            run_number: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true
            },
            name: {
                type: DataTypes.TEXT,
                allowNull: false,
                primaryKey: true
            }
        },
        {
            name: {
                singular: 'CycleDataset',
                plural: 'CycleDataset'
            }
        }
    );
    CycleDataset.associate = function(models) {
        CycleDataset.belongsTo(models.Cycle, {
            foreignKey: {
                name: 'id_cycle'
            }
        });
        CycleDataset.hasMany(models.Dataset, {
            foreignKey: 'name',
            sourceKey: 'name',
            scope: {
                run_number: sequelize.where(
                    sequelize.col('CycleDataset.run_number'),
                    '=',
                    sequelize.col('CycleDataset->Datasets.run_number')
                )
            }
        });

        // Until sequelize supports multiple foreign keys
    };
    return CycleDataset;
};
