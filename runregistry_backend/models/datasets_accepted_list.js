module.exports = (sequelize, DataTypes) => {
    const DatasetsAcceptedList = sequelize.define(
        'DatasetsAcceptedList',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            }
        },
        { timestamps: false }
    );
    DatasetsAcceptedList.associate = function(models) {
        DatasetsAcceptedList.hasMany(models.Settings, {
            foreignKey: {
                name: 'DAL_id',
                allowNull: false
            },
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT'
        });
        DatasetsAcceptedList.belongsToMany(models.DatasetsAccepted, {
            through: models.DatasetsAcceptedEntries,
            foreignKey: 'DAL_id',
            otherKey: 'id',
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT'
        });
    };
    return DatasetsAcceptedList;
};
