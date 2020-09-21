const { save_runs } = require('../cron/2.save_or_update_runs');
const queue = require('async').queue;

const { lstatSync, readdirSync, readFileSync } = require('fs');
const { join } = require('path');

const isDirectory = source => lstatSync(source).isDirectory();

const getDirectories = source =>
    readdirSync(source)
        .map(name => join(source, name))
        .filter(isDirectory);

const missing_runs = [
    143056,
    185319,
    209305,
    214676,
    215267,
    216474,
    222718,
    229831,
    231614,
    233238,
    264593,
    287446,
    289670,
    309487,
    309868,
    328833,
    328903
];

const classify_runs = () => {
    const runs_directories = getDirectories(`${__dirname}/runs`);
    const runs = [];
    runs_directories.forEach((run, index) => {
        const run_number = +run.split('/uploader/runs/')[1];
        // Only interested in those of 2018
        // if (run_number >= 329403) {
        if (missing_runs.includes(run_number)) {
            const run_info = JSON.parse(
                readFileSync(`${__dirname}/runs/${run_number}/run.json`)
            ).attributes;

            let lumisection_info = JSON.parse(
                readFileSync(
                    `${__dirname}/runs/${run_number}/lumisections.json`
                )
            );
            lumisection_info = lumisection_info.map(
                ({ attributes }) => attributes
            );
            run_info.lumisections = lumisection_info;
            runs.push(run_info);
        }
    });

    save_runs(runs);

    // const asyncQueue = queue(async);
};

classify_runs();
