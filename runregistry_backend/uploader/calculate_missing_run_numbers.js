const { Client } = require('pg');
const { save_runs } = require('../cron/2.save_or_update_runs');
const sequelize = require('../models').sequelize;
const queue = require('async').queue;

const connectionString =
    'postgresql://fabioespinosa:@localhost:5432/hackathon5';

const { lstatSync, readdirSync, readFileSync } = require('fs');
const { join } = require('path');

const isDirectory = source => lstatSync(source).isDirectory();

const getDirectories = source =>
    readdirSync(source)
        .map(name => join(source, name))
        .filter(isDirectory);

const save_run_numbers = async () => {
    const client = new Client({
        connectionString: connectionString
    });
    await client.connect();
    const runs_directories = getDirectories(`${__dirname}/runs`);
    const runs = [];
    const promises = runs_directories.map(async (run, index) => {
        const run_number = +run.split('/uploader/runs/')[1];
        try {
            const sql_query = await client.query(
                `INSERT INTO "TemporaryRunNumberTable" (run_number) values (${run_number})`
            );
        } catch (e) {
            console.log('Error: ', run_number);
            console.log(e);
        }
    });

    await Promise.all(promises);
};

save_run_numbers();
