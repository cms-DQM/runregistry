module.exports = (sequelize, DataTypes) => {
    const JsonClassifierList = sequelize.define(
        'JsonClassifierList',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            }
        },
        { timestamps: false }
    );
    JsonClassifierList.associate = function(models) {
        JsonClassifierList.hasMany(models.Settings, {
            foreignKey: {
                name: 'JCL_id',
                allowNull: false
            },
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT'
        });
        JsonClassifierList.belongsToMany(models.JsonClassifier, {
            through: models.JsonClassifierEntries,
            foreignKey: 'JCL_id',
            otherKey: 'id',
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT'
        });
    };
    return JsonClassifierList;
};
