const axios = require('axios');
const { moveRun } = require('../controllers/run');
const queue = require('async').queue;
const { API_URL } = require('../config/config')['development'];

const { lstatSync, readdirSync, readFileSync } = require('fs');
const { join } = require('path');
const not_saved = [];
const saved = [];
let counter = 0;

const isDirectory = source => lstatSync(source).isDirectory();

const getDirectories = source =>
    readdirSync(source)
        .map(name => join(source, name))
        .filter(isDirectory);

const signoff_runs = async () => {
    const runs_directories = getDirectories(`${__dirname}/runs`);

    const promises = runs_directories.map((run, index) => async () => {
        const run_number = +run.split('/uploader/runs/')[1];
        if (run_number >= 307926) {
            try {
                await axios.post(
                    `${API_URL}/runs/move_run/OPEN/SIGNOFF`,
                    { original_run: { run_number } },
                    {
                        headers: { email: 'f.e@cern.ch' }
                    }
                );
                saved.push(run_number);
                counter += 1;
                console.log(counter);
            } catch (e) {
                // console.log(e);
                not_saved.push(run_number);
            }
        }
    });
    const asyncQueue = queue(async run => await run(), 1);
    asyncQueue.drain = async () => {
        console.log('Saved' + saved);
        console.log('Not saved' + not_saved);
    };
    asyncQueue.error = err => {
        console.log(`Critical error saving runs, ${JSON.stringify(err)}`);
    };
    asyncQueue.push(promises);
};

signoff_runs();
