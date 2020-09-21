module.exports = (sequelize, DataTypes) => {
    const LumisectionEventAssignation = sequelize.define(
        'LumisectionEventAssignation',
        {
            version: {
                type: DataTypes.INTEGER,
                primaryKey: true
            },
            lumisection_number: {
                type: DataTypes.INTEGER,
                primaryKey: true
            }
        },
        { timestamps: false }
    );
    LumisectionEventAssignation.associate = function(models) {
        LumisectionEventAssignation.belongsTo(models.Event, {
            foreignKey: {
                name: 'version'
            }
        });
    };
    return LumisectionEventAssignation;
};
