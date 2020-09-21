module.exports = (sequelize, DataTypes) => {
    const PermissionList = sequelize.define(
        'PermissionList',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            }
        },
        { timestamps: false }
    );
    PermissionList.associate = function(models) {
        PermissionList.hasMany(models.Settings, {
            foreignKey: {
                name: 'PL_id',
                allowNull: false
            }
        });
        PermissionList.belongsToMany(models.Permission, {
            through: models.PermissionEntries,
            foreignKey: 'PL_id',
            otherKey: 'id'
        });
    };
    return PermissionList;
};
