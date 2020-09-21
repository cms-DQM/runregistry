const fs = require('fs');
const path = require('path');

module.exports = (sequelize, DataTypes) => {
    const RunView = sequelize.define(
        'RunView',
        {
            run_number: { type: DataTypes.INTEGER, primaryKey: true },
            oms_attributes: { type: DataTypes.JSONB },
            rr_attributes: { type: DataTypes.JSONB },
            version: { type: DataTypes.INTEGER }
        },
        { timestamps: false }
    );

    RunView.sync = options => {
        const viewPath = path.resolve(__dirname, '../views/run.sql');
        const file = fs.readFileSync(viewPath, { encoding: 'utf-8' });
        sequelize.query(file);
        return null;
    };
    RunView.drop = async options => {
        return sequelize.query('DROP VIEW IF EXISTS "RunView"', {
            logging: options.logging
        });
    };

    return RunView;
};
