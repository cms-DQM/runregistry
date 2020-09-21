const sequelize = require('../models').sequelize;
const { update_or_create_run } = require('../controllers/run');
const queue = require('async').queue;
const Run = require('../models').Run;

const { lstatSync, readdirSync, readFileSync } = require('fs');
const { join } = require('path');

const isDirectory = source => lstatSync(source).isDirectory();

const getDirectories = source =>
    readdirSync(source)
        .map(name => join(source, name))
        .filter(isDirectory);

exports.classify_runs = () => {
    const promiseSerial = funcs =>
        funcs.reduce(
            (promise, func) =>
                promise.then(result =>
                    func().then(Array.prototype.concat.bind(result))
                ),
            Promise.resolve([])
        );

    const runs_directories = getDirectories(`${__dirname}/runs`);

    const promises = runs_directories.map((run, index) => async () => {
        const run_number = +run.split('/uploader/runs/')[1];

        if (index >= 12000) {
            const { oms_attributes } = await Run.findByPk(run_number);
            const { l1_hlt_mode } = oms_attributes;
            if (l1_hlt_mode) {
                const class_name = l1_hlt_mode
                    .split('20')
                    .join('')
                    .split('HI')
                    .join('');
                const capitalized_class_name =
                    class_name.charAt(0).toUpperCase() + class_name.slice(1);
                console.log(capitalized_class_name);
                if (
                    capitalized_class_name.includes('Cosmics') ||
                    capitalized_class_name.includes('Collisions') ||
                    capitalized_class_name.includes('Commissioning')
                ) {
                    await update_or_create_run(
                        run_number,
                        {},
                        { class: capitalized_class_name },
                        {
                            email: 'f.e@cern.ch',
                            comment: 'update class'
                        }
                    );
                }
            }
        }
    });
    promiseSerial(promises);
    // const asyncQueue = queue(async);
};
