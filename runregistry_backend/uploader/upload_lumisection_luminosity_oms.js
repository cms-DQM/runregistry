const { update_runs } = require('../cron/2.save_or_update_runs');
const queue = require('async').queue;

const { lstatSync, readdirSync, readFileSync } = require('fs');
const { join } = require('path');

const isDirectory = source => lstatSync(source).isDirectory();

const getDirectories = source =>
    readdirSync(source)
        .map(name => join(source, name))
        .filter(isDirectory);

const classify_runs = async () => {
    const runs_directories = getDirectories(`${__dirname}/runs`);
    const runs = [];
    runs_directories.forEach((run, index) => {
        const run_number = +run.split('/uploader/runs/')[1];
        // Only interested in those of 2018
        if (run_number === 273493) {
            const run_info = JSON.parse(
                readFileSync(`${__dirname}/runs/${run_number}/run.json`)
            ).attributes;

            let oms_lumisections = JSON.parse(
                readFileSync(
                    `${__dirname}/runs/${run_number}/lumisections.json`
                )
            );
            oms_lumisections = oms_lumisections.map(
                ({ attributes }) => attributes
            );
            oms_lumisections = oms_lumisections.map(
                (
                    { recorded_lumi, delivered_lumi },
                    index,
                    oms_lumisections
                ) => {
                    // If any of them is null, then the per_lumi are all null
                    if (recorded_lumi === null || delivered_lumi === null) {
                        return {
                            ...oms_lumisections[index],
                            recorded_lumi_per_lumi: null,
                            delivered_lumi_per_lumi: null,
                            live_lumi_per_lumi: null
                        };
                    }
                    // we parse them to number:
                    recorded_lumi = +recorded_lumi;
                    delivered_lumi = +delivered_lumi;
                    // recorded_lumi and delivered_lumi are integrated, we have to substract the one in lumisection before to get real value.
                    let recorded_lumi_per_lumi;
                    let delivered_lumi_per_lumi;
                    // If we are at the last lumisection then recorde_lumi_per_lumi and delivered_lumi are 0
                    if (index === oms_lumisections.length - 1) {
                        recorded_lumi_per_lumi = 0;
                        delivered_lumi_per_lumi = 0;
                    } else {
                        // If we are in any other lumisection then we have to subtract the current value from the next lumisection to get the number of the current LS
                        const next_lumisection = oms_lumisections[index + 1];
                        recorded_lumi_per_lumi =
                            next_lumisection.recorded_lumi - recorded_lumi;
                        delivered_lumi_per_lumi =
                            next_lumisection.delivered_lumi - delivered_lumi;
                    }
                    // live lumi is the fraction of recorded/delivered:
                    let live_lumi_per_lumi = null;
                    if (delivered_lumi_per_lumi !== 0) {
                        live_lumi_per_lumi =
                            recorded_lumi_per_lumi / delivered_lumi_per_lumi;
                    }
                    return {
                        ...oms_lumisections[index],
                        recorded_lumi_per_lumi,
                        delivered_lumi_per_lumi,
                        live_lumi_per_lumi
                    };
                }
            );
            if (oms_lumisections.length > 0) {
                run_info.lumisections = oms_lumisections;
                runs.push(run_info);
            }
        }
    });
    try {
        const promise = await update_runs(runs, 0, {});
    } catch (e) {
        console.log(e);
    }

    // const asyncQueue = queue(async);
};

classify_runs();
