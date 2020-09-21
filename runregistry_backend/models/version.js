module.exports = (sequelize, DataTypes) => {
    const Version = sequelize.define(
        'Version',
        {
            atomic_version: {
                primaryKey: true,
                type: DataTypes.INTEGER,
                autoIncrement: true
            },
            by: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            comment: {
                type: DataTypes.TEXT,
                allowNull: true
            }
        },
        {
            updatedAt: false
        }
    );
    Version.associate = function(models) {
        Version.hasMany(models.Event, { foreignKey: 'atomic_version' });
    };
    return Version;
};
