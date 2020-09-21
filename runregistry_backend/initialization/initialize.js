const sequelize = require('../models').sequelize;
const config = require('../config/config')[process.env.ENV || 'development'];

// Self invoking function for initialization.

// It will add roles to INSERT to the user configured in settings
// It will make sure there is at least 1 value in all "Lists"
// It will make sure there is at least 1 Setting referencing the maximum list value
module.exports = async () => {
    let transaction;
    try {
        transaction = await sequelize.transaction();

        // await sequelize.query(
        //     `GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA "public" to "${
        //         config.username
        //     }"`,
        //     { transaction }
        // );
        // console.log(
        //     `Permissions granted on all tables to SELECT and INSERT to user ${
        //         config.username
        //     }. DELETE and UPDATE are not permited (this is intended behavior of RR)`
        // );

        // Insert compound foreign keys, see  https://github.com/sequelize/sequelize/issues/311

        await sequelize.query(
            `
            ALTER TABLE IF EXISTS "LumisectionEvent" DROP CONSTRAINT IF EXISTS "LumisectionEvent_datasetReference_fkey";
            ALTER TABLE IF EXISTS "LumisectionEvent"
            ADD CONSTRAINT "LumisectionEvent_datasetReference_fkey"
            FOREIGN KEY (run_number, name)
            REFERENCES "Dataset" ON UPDATE CASCADE;
        `,
            { transaction }
        );

        await sequelize.query(
            `
            ALTER TABLE IF EXISTS "OMSLumisectionEvent" DROP CONSTRAINT IF EXISTS "OMSLumisectionEvent_datasetReference_fkey";
            ALTER TABLE IF EXISTS "OMSLumisectionEvent"
            ADD CONSTRAINT "OMSLumisectionEvent_datasetReference_fkey"
            FOREIGN KEY (run_number, name)
            REFERENCES "Dataset" ON UPDATE CASCADE;
        `,
            { transaction }
        );

        await sequelize.query(
            `
            ALTER TABLE IF EXISTS "DatasetTripletCache" DROP CONSTRAINT IF EXISTS "DatasetTripletCache_datasetReference_fkey";
            ALTER TABLE IF EXISTS "DatasetTripletCache"
            ADD CONSTRAINT "DatasetTripletCache_datasetReference_fkey"
            FOREIGN KEY (run_number, name)
            REFERENCES "Dataset" ON UPDATE CASCADE;
        `,
            { transaction }
        );

        await sequelize.query(
            `
            ALTER TABLE IF EXISTS "CycleDataset" DROP CONSTRAINT IF EXISTS "CycleDataset_datasetReference_fkey";
            ALTER TABLE IF EXISTS "CycleDataset"
            ADD CONSTRAINT "CycleDataset_datasetReference_fkey"
            FOREIGN KEY (run_number, name)
            REFERENCES "Dataset" ON UPDATE CASCADE;
        `,
            { transaction }
        );

        // Initialize data:
        const insert_1_into_lists = [
            'INSERT INTO "ClassClassifierList" ("id") VALUES (1) ON CONFLICT DO NOTHING;',
            'INSERT INTO "ComponentClassifierList" ("id") VALUES (1) ON CONFLICT DO NOTHING;',
            'INSERT INTO "DatasetClassifierList" ("id") VALUES (1) ON CONFLICT DO NOTHING;',
            'INSERT INTO "OfflineDatasetClassifierList" ("id") VALUES (1) ON CONFLICT DO NOTHING;',
            'INSERT INTO "PermissionList" ("id") VALUES (1) ON CONFLICT DO NOTHING;',
            'INSERT INTO "DatasetsAcceptedList" ("id") VALUES (1) ON CONFLICT DO NOTHING;',
            'INSERT INTO "JsonClassifierList" ("id") VALUES (1) ON CONFLICT DO NOTHING;'
        ];
        const insert_1_into_lists_promises = insert_1_into_lists.map(query => {
            return sequelize.query(query, { transaction });
        });
        await Promise.all(insert_1_into_lists_promises);

        const result = await sequelize.query('SELECT * FROM "Settings"', {
            transaction
        });
        const settings = result[0];
        if (settings.length === 0) {
            // If Settings are empty, we need to fill them with highest id in all tables:
            await sequelize.query(
                `
                INSERT INTO "Settings" (id, metadata, "createdAt","CCL_id", "CPCL_id", "DCL_id","ODCL_id", "PL_id", "DAL_id", "JCL_id")
                VALUES 
                (
                (SELECT COALESCE((SELECT MAX("id") from "Settings"), 0)+1),
                '{"comment":"First row created automatically because of no setting previously created"}', 
                '2019-02-05 12:54:48.779-05',
                (SELECT MAX("id") FROM "ClassClassifierList"),
                (SELECT MAX("id") FROM "ComponentClassifierList"),
                (SELECT MAX("id") FROM "DatasetClassifierList"),
                (SELECT MAX("id") FROM "OfflineDatasetClassifierList"),
                (SELECT MAX("id") FROM "PermissionList"),
                (SELECT MAX("id") FROM "DatasetsAcceptedList"),
                (SELECT MAX("id") FROM "JsonClassifierList")
                );
                `,
                { transaction }
            );
            console.log(
                'Settings Table was empty, first row was entered automatically'
            );
        }
        await transaction.commit();
    } catch (err) {
        await transaction.rollback();
        if (err.message === 'relation "Settings" does not exist') {
            console.log(
                'ERROR: Try running again, table Settings was not created yet, it should be created by now, and running it again should show no errors'
            );
        } else {
            console.log('Error initializing schema');
            console.log(err);
        }
    }
};
