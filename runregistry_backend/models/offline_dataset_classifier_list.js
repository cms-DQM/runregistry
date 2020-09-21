module.exports = (sequelize, DataTypes) => {
    const OfflineDatasetClassifierList = sequelize.define(
        'OfflineDatasetClassifierList',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            }
        },
        { timestamps: false }
    );

    OfflineDatasetClassifierList.associate = function(models) {
        OfflineDatasetClassifierList.hasMany(models.Settings, {
            foreignKey: {
                name: 'ODCL_id',
                allowNull: false
            }
        });
        OfflineDatasetClassifierList.belongsToMany(
            models.OfflineDatasetClassifier,
            {
                through: models.OfflineDatasetClassifierEntries,
                foreignKey: 'ODCL_id',
                otherKey: 'id'
            }
        );
    };
    return OfflineDatasetClassifierList;
};
