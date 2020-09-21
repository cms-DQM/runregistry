module.exports = (sequelize, DataTypes) => {
    const Workspace = sequelize.define(
        'Workspace',
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            workspace: {
                type: DataTypes.TEXT,
                allowNull: false,
                unique: 'Workspace_unique_column_online_offline_constraint'
            },
            online_or_offline: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: 'Workspace_unique_column_online_offline_constraint'
            }
        },
        {
            name: {
                singular: 'Workspace',
                plural: 'Workspace'
            },
            uniqueKeys: [
                {
                    name: 'Workspace_unique_column_online_offline_constraint',
                    fields: ['workspace', 'online_or_offline']
                }
            ]
        }
    );
    Workspace.associate = function(models) {
        Workspace.hasMany(models.WorkspaceColumn, {
            as: 'columns',
            foreignKey: 'id_workspace'
        });
    };
    return Workspace;
};
