module.exports = (sequelize, DataTypes) => {
    const DatasetClassifier = sequelize.define(
        'DatasetClassifier',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            class: {
                type: DataTypes.STRING,
                allowNull: false
            },
            classifier: {
                type: DataTypes.JSONB,
                allowNull: false
            },
            enabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false
            }
        },
        {
            updatedAt: false,
            name: {
                singular: 'DatasetClassifier',
                plural: 'DatasetClassifier'
            }
        }
    );
    DatasetClassifier.associate = function(models) {
        DatasetClassifier.belongsToMany(models.DatasetClassifierList, {
            through: models.DatasetClassifierEntries,
            foreignKey: 'id',
            otherKey: 'DCL_id'
        });
    };
    return DatasetClassifier;
};
