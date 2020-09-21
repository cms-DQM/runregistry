module.exports = (sequelize, DataTypes) => {
    const OMSLumisectionEventAssignation = sequelize.define(
        'OMSLumisectionEventAssignation',
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
    OMSLumisectionEventAssignation.associate = function(models) {
        OMSLumisectionEventAssignation.belongsTo(models.Event, {
            foreignKey: {
                name: 'version'
            }
        });
    };
    return OMSLumisectionEventAssignation;
};
