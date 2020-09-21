module.exports = (sequelize, DataTypes) => {
    const ComponentClassifierEntries = sequelize.define(
        'ComponentClassifierEntries',
        {},
        { timestamps: false }
    );
    ComponentClassifierEntries.associate = function(models) {
        ComponentClassifierEntries.belongsTo(models.ComponentClassifierList, {
            foreignKey: {
                name: 'CPCL_id'
            }
        });
        ComponentClassifierEntries.belongsTo(models.ComponentClassifier, {
            foreignKey: {
                name: 'id'
            }
        });
    };
    return ComponentClassifierEntries;
};
