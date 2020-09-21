module.exports = (sequelize, DataTypes) => {
    const Run = sequelize.define(
        'Run',
        {
            run_number: { type: DataTypes.INTEGER, primaryKey: true },
            oms_attributes: { type: DataTypes.JSONB, allowNull: false },
            rr_attributes: { type: DataTypes.JSONB, allowNull: false },
            version: { type: DataTypes.INTEGER, allowNull: false },
            deleted: { type: DataTypes.BOOLEAN, allowNull: false }
        },
        {
            timestamps: false,
            indexes: [
                { name: 'Run_version_index', fields: ['version'] },
                { name: 'Run_deleted_index', fields: ['deleted'] }
            ]
        }
    );
    Run.associate = function(models) {
        // A run has many datasets, but it only has 1 corresponding to the data that came form online, this one has a 'name' of 'online
        Run.hasMany(models.Dataset, { foreignKey: 'run_number' });
        Run.hasOne(models.DatasetTripletCache, { foreignKey: 'run_number' });
        Run.hasOne(models.DatasetTripletCache, {
            constraints: false,
            foreignKey: 'run_number',
            sourceKey: 'run_number',
            scope: {
                name: 'online'
            }
        });
    };
    return Run;
};
