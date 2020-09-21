module.exports = (sequelize, DataTypes) => {
    const DatasetsAcceptedEntries = sequelize.define(
        'DatasetsAcceptedEntries',
        {},
        { timestamps: false }
    );
    DatasetsAcceptedEntries.associate = function(models) {
        DatasetsAcceptedEntries.belongsTo(models.DatasetsAcceptedList, {
            foreignKey: {
                name: 'DAL_id'
            }
        });
        DatasetsAcceptedEntries.belongsTo(models.DatasetsAccepted, {
            foreignKey: {
                name: 'id'
            }
        });
    };
    return DatasetsAcceptedEntries;
};
