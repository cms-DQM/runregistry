module.exports = (sequelize, DataTypes) => {
    const DatasetClassifierEntries = sequelize.define(
        'DatasetClassifierEntries',
        {},
        { timestamps: false }
    );
    DatasetClassifierEntries.associate = function(models) {
        DatasetClassifierEntries.belongsTo(models.DatasetClassifierList, {
            foreignKey: {
                name: 'DCL_id'
            }
        });
        DatasetClassifierEntries.belongsTo(models.DatasetClassifier, {
            foreignKey: {
                name: 'id'
            }
        });
    };
    return DatasetClassifierEntries;
};
