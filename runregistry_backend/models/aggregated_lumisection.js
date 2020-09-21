const fs = require('fs');
const path = require('path');

module.exports = (sequelize, DataTypes) => {
    const AggregatedLumisection = sequelize.define(
        'AggregatedLumisection',
        {
            run_number: { type: DataTypes.INTEGER, primaryKey: true },
            name: { type: DataTypes.TEXT, primaryKey: true },
            lumisection_number: { type: DataTypes.INTEGER },
            oms_lumisection: { type: DataTypes.JSONB },
            rr_lumisection: { type: DataTypes.JSONB },
            run_rr_attributes: { type: DataTypes.JSONB },
            run_oms_attributes: { type: DataTypes.JSONB },
            dataset_attributes: { type: DataTypes.JSONB }
        },
        { timestamps: false }
    );

    AggregatedLumisection.sync = options => {
        const viewPath = path.resolve(__dirname, '../views/run.sql');
        const file = fs.readFileSync(viewPath, { encoding: 'utf-8' });
        sequelize.query(file);
        return null;
    };
    AggregatedLumisection.drop = async options => {
        return sequelize.query('DROP VIEW IF EXISTS "AggregatedLumisection"', {
            logging: options.logging
        });
    };

    return AggregatedLumisection;
};
