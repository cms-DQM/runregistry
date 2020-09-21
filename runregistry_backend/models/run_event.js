module.exports = (sequelize, DataTypes) => {
    const RunEvent = sequelize.define(
        'RunEvent',
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
            oms_metadata: {
                type: DataTypes.JSONB,
                allowNull: false
            },
            rr_metadata: {
                type: DataTypes.JSONB,
                allowNull: false
            },
            deleted: {
                type: DataTypes.BOOLEAN,
                allowNull: false
            },
            manual_change: {
                type: DataTypes.BOOLEAN,
                allowNull: false
            }
        },
        {
            timestamps: false,
            indexes: [
                { name: 'RunEvent_runNumber_index', fields: ['run_number'] }
            ]
        }
    );
    RunEvent.associate = function(models) {
        RunEvent.belongsTo(models.Event, { foreignKey: 'version' });
    };

    return RunEvent;
};
