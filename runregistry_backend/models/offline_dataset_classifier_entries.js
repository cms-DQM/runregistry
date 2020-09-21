module.exports = (sequelize, DataTypes) => {
    const OfflineDatasetClassifierEntries = sequelize.define(
        'OfflineDatasetClassifierEntries',
        {},
        { timestamps: false }
    );
    OfflineDatasetClassifierEntries.associate = function(models) {
        OfflineDatasetClassifierEntries.belongsTo(
            models.OfflineDatasetClassifierList,
            {
                foreignKey: {
                    name: 'ODCL_id'
                }
            }
        );
        OfflineDatasetClassifierEntries.belongsTo(
            models.OfflineDatasetClassifier,
            {
                foreignKey: {
                    name: 'id'
                }
            }
        );
    };
    return OfflineDatasetClassifierEntries;
};
