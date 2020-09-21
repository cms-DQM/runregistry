module.exports = (sequelize, DataTypes) => {
    const ComponentClassifierList = sequelize.define(
        'ComponentClassifierList',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            }
        },
        { timestamps: false }
    );
    ComponentClassifierList.associate = function(models) {
        ComponentClassifierList.hasMany(models.Settings, {
            foreignKey: {
                name: 'CPCL_id',
                allowNull: false
            }
        });
        ComponentClassifierList.belongsToMany(models.ComponentClassifier, {
            through: models.ComponentClassifierEntries,
            foreignKey: 'CPCL_id',
            otherKey: 'id'
        });
    };
    return ComponentClassifierList;
};
