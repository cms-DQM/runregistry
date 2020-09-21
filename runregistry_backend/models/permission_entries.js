module.exports = (sequelize, DataTypes) => {
    const PermissionEntries = sequelize.define(
        'PermissionEntries',
        {},
        { timestamps: false }
    );
    PermissionEntries.associate = function(models) {
        PermissionEntries.belongsTo(models.PermissionList, {
            foreignKey: {
                name: 'PL_id'
            }
        });
        PermissionEntries.belongsTo(models.Permission, {
            foreignKey: {
                name: 'id'
            }
        });
    };
    return PermissionEntries;
};
