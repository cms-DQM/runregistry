module.exports = (sequelize, DataTypes) => {
    const DatasetsAccepted = sequelize.define(
        'DatasetsAccepted',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false
            },
            regexp: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            enabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false
            },
            class: {
                type: DataTypes.STRING,
                allowNull: false
            },
            run_from: {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            run_to: {
                type: DataTypes.INTEGER,
                allowNull: false
            }
        },
        {
            updatedAt: false
        }
    );
    DatasetsAccepted.associate = function(models) {
        DatasetsAccepted.belongsToMany(models.DatasetsAcceptedList, {
            through: models.DatasetsAcceptedEntries,
            foreignKey: 'id',
            otherKey: 'DAL_id'
        });
    };
    return DatasetsAccepted;
};
