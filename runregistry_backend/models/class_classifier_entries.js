module.exports = (sequelize, DataTypes) => {
    const ClassClassifierEntries = sequelize.define(
        'ClassClassifierEntries',
        {},
        { timestamps: false }
    );
    ClassClassifierEntries.associate = function(models) {
        ClassClassifierEntries.belongsTo(models.ClassClassifier, {
            foreignKey: {
                name: 'id'
            }
        });
        ClassClassifierEntries.belongsTo(models.ClassClassifierList, {
            foreignKey: {
                name: 'CCL_id'
            }
        });
    };
    return ClassClassifierEntries;
};
