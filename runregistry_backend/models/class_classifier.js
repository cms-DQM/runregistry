module.exports = (sequelize, DataTypes) => {
    const ClassClassifier = sequelize.define(
        'ClassClassifier',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            class: { type: DataTypes.STRING, allowNull: false },
            classifier: { type: DataTypes.JSONB, allowNull: false },
            priority: { type: DataTypes.INTEGER, allowNull: false },
            enabled: { type: DataTypes.BOOLEAN, allowNull: false }
        },
        {
            updatedAt: false,
            name: {
                singular: 'ClassClassifier',
                plural: 'ClassClassifier'
            }
        }
    );
    ClassClassifier.associate = function(models) {
        ClassClassifier.belongsToMany(models.ClassClassifierList, {
            through: models.ClassClassifierEntries,
            foreignKey: 'id',
            otherKey: 'CCL_id'
        });
    };
    return ClassClassifier;
};
