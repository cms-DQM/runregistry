module.exports = (sequelize, DataTypes) => {
    const JsonClassifierEntries = sequelize.define(
        'JsonClassifierEntries',
        {},
        { timestamps: false }
    );
    JsonClassifierEntries.associate = function(models) {
        JsonClassifierEntries.belongsTo(models.JsonClassifierList, {
            foreignKey: {
                name: 'JCL_id'
            }
        });
        JsonClassifierEntries.belongsTo(models.JsonClassifier, {
            foreignKey: {
                name: 'id'
            }
        });
    };
    return JsonClassifierEntries;
};
