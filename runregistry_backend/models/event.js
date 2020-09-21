module.exports = (sequelize, DataTypes) => {
    const Event = sequelize.define(
        'Event',
        {
            version: {
                primaryKey: true,
                type: DataTypes.INTEGER,
                autoIncrement: true
            },
            atomic_version: {
                type: DataTypes.INTEGER,
                allowNull: false
            }
        },
        {
            createdAt: false,
            updatedAt: false
        }
    );
    Event.associate = function(models) {
        Event.belongsTo(models.Version, {
            foreignKey: 'atomic_version'
        });
        Event.hasOne(models.RunEvent, { foreignKey: 'version' });
        Event.hasOne(models.DatasetEvent, { foreignKey: 'version' });
        Event.hasMany(models.LumisectionEvent, { foreignKey: 'version' });
        Event.hasMany(models.OMSLumisectionEvent, { foreignKey: 'version' });
    };
    return Event;
};
