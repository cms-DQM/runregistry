// About sequelize.define
// https://sequelize.org/v3/docs/models-definition/
// To define mappings between a model and a table, use the define method. Sequelize will then automatically add the attributes createdAt and updatedAt to it. 
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
                type: DataTypes.JSONB, // JSONB - JSON input text in a decomposed binary form
                allowNull: false
            }
        },
        {
            updatedAt: false
        }
    );

    Permission.associate = function(models) {
        Permission.belongsToMany(models.PermissionList, { through: models.PermissionEntries, foreignKey: 'id', otherKey: 'PL_id' });
    };
    return Permission;
};
