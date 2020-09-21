module.exports = (sequelize, DataTypes) => {
    const JsonClassifier = sequelize.define(
        'JsonClassifier',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name: { type: DataTypes.STRING, allowNull: false },
            classifier: { type: DataTypes.JSONB, allowNull: false }
        },
        {
            updatedAt: false,
            name: {
                singular: 'JsonClassifier',
                plural: 'JsonClassifier'
            }
        }
    );
    JsonClassifier.associate = function(models) {
        JsonClassifier.belongsToMany(models.JsonClassifierList, {
            through: models.JsonClassifierEntries,
            foreignKey: 'id',
            otherKey: 'JCL_id'
        });
    };
    return JsonClassifier;
};
