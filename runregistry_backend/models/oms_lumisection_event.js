module.exports = (sequelize, DataTypes) => {
    const OMSLumisectionEvent = sequelize.define(
        'OMSLumisectionEvent',
        {
            version: {
                primaryKey: true,
                type: DataTypes.INTEGER,
                autoIncrement: true
            },
            run_number: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            name: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            lumisection_metadata_id: {
                type: DataTypes.INTEGER,
                allowNull: false
            }
        },
        {
            timestamps: false,
            name: {
                singular: 'OMSLumisectionEvent',
                plural: 'OMSLumisectionEvent'
            },
            indexes: [
                {
                    name: 'OMSLumisectionEvent_datasetReference_index',
                    fields: ['run_number', 'name']
                }
            ]
        }
    );
    OMSLumisectionEvent.associate = function(models) {
        OMSLumisectionEvent.belongsTo(models.Event, { foreignKey: 'version' });
        OMSLumisectionEvent.belongsTo(models.JSONBDeduplication, {
            foreignKey: 'lumisection_metadata_id'
        });
        OMSLumisectionEvent.hasMany(models.OMSLumisectionEventAssignation, {
            foreignKey: 'version'
        });
        // THE FOLLOWING 3 LINES ARE NOT YET SUPPORTED IN SEQUELIZE, WE HAVE TO INITIALIZE THE COMPOUND FOREIGN KEY TO DATASET IN initialization/initialize.js file
        // OMSLumisectionEvent.belongsTo(models.Dataset, {
        //     foreignKey: ['run_number','name']
        // })
    };

    return OMSLumisectionEvent;
};
