module.exports = (sequelize, DataTypes) => {
    const Permission = sequelize.define(
        'Permission',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            egroup: {
                type: DataTypes.STRING,
                allowNull: false
            },
            routes: {
                type: DataTypes.JSONB,
                allowNull: false
            }
        },
        {
            updatedAt: false
        }
    );

    Permission.associate = function(models) {
        Permission.belongsToMany(models.PermissionList, {
            through: models.PermissionEntries,
            foreignKey: 'id',
            otherKey: 'PL_id'
        });
    };
    return Permission;
};
