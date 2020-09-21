const { save_runs } = require('../cron/2.save_or_update_runs');
const { Run, RunEvent, Event, sequelize, Sequelize } = require('../models');
const queue = require('async').queue;

const { lstatSync, readdirSync, readFileSync } = require('fs');
const { join } = require('path');
const { Op } = Sequelize;

const isDirectory = source => lstatSync(source).isDirectory();

const getDirectories = source =>
    readdirSync(source)
        .map(name => join(source, name))
        .filter(isDirectory);

const save_fills = () => {
    const fills_directories = getDirectories(`${__dirname}/fills`);
    const ordered_fills = fills_directories.sort((a, b) => {
        const fill_id_1 = +a.split('/uploader/fills/')[1];
        const fill_id_2 = +b.split('/uploader/fills/')[1];
        return fill_id_1 - fill_id_2;
    });
    const failed_fills = [];
    const promises = ordered_fills.map((fill_path, index) => async () => {
        const fill_id = +fill_path.split('/uploader/fills/')[1];
        // Only interested in those of 2018
        const fill_info = JSON.parse(
            readFileSync(`${__dirname}/fills/${fill_id}/fill.json`)
        ).attributes;

        try {
            await save_fill(fill_info);
        } catch (err) {
            console.log('fail for fill: ', fill_id);
            failed_fills.push(fill_id);
            console.log(err);
        }
    });
    const asyncQueue = queue(async fill => await fill(), 60);
    asyncQueue.drain = async () => {
        console.log(failed_fills);
        console.log('finished');
    };
    asyncQueue.error = err => {
        console.log(err);
    };
    asyncQueue.push(promises);
};

const save_fill = async fill_info => {
    const {
        first_run_number,
        last_run_number,
        injection_scheme,
        fill_type_runtime
    } = fill_info;
    const runs = await Run.findAll({
        where: {
            run_number: {
                [Op.gte]: first_run_number,
                [Op.lte]: last_run_number
            }
        }
    });
    const transaction = await sequelize.transaction();
    const promises = runs.map(async run => {
        const { run_number } = run;
        await save_run_event({
            transaction,
            run_number,
            injection_scheme,
            fill_type_runtime
        });
    });
    await Promise.all(promises);
    await transaction.commit();
};

const save_run_event = async ({
    transaction,
    run_number,
    injection_scheme,
    fill_type_runtime
}) => {
    const event = await Event.create(
        {
            by: 'auto@auto',
            comment: 'add injection_scheme and fill_type_runtime from OMS'
        },
        { transaction }
    );
    const runEvent = await RunEvent.create(
        {
            run_number,
            oms_metadata: {
                injection_scheme,
                fill_type_runtime
            },
            rr_metadata: {},
            version: event.version,
            deleted: false,
            manual_change: false
        },
        { transaction }
    );
    // await sequelize.query(
    //     `
    // CREATE TEMPORARY TABLE updated_runnumbers as SELECT DISTINCT "run_number" from "RunEvent" where "RunEvent"."version" > (SELECT COALESCE((SELECT MAX("version") from "Run"), 0));
    // CREATE TEMPORARY TABLE updated_runs as SELECT * FROM "RunEvent"
    // WHERE "RunEvent"."run_number" IN (
    //     SELECT * from updated_runnumbers
    // );

    // INSERT INTO "Run" (run_number, rr_attributes, oms_attributes, deleted, "version")
    // SELECT run_number,
    //         mergejsonb(rr_metadata ORDER BY manual_change, version),
    //         mergejsonb(oms_metadata ORDER BY version),
    //         (SELECT deleted from "RunEvent" WHERE "version" = (SELECT max(version) FROM updated_runs)) AS "deleted",
    //         (SELECT max(version) FROM "RunEvent" ) AS "version"
    // FROM updated_runs
    // GROUP BY run_number
    // ON CONFLICT (run_number) DO UPDATE SET "rr_attributes" = EXCLUDED."rr_attributes", "oms_attributes" = EXCLUDED."oms_attributes", "deleted" = EXCLUDED."deleted", "version" = EXCLUDED.version;

    // DROP TABLE updated_runnumbers;
    // DROP TABLE updated_runs;
    //     `,
    //     { transaction }
    // );
};
save_fills();
