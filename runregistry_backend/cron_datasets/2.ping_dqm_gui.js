// This is a microservice, it works independently from the API, it doesn't share computer resources and so it doesn't impact the performance of the API
const { Sequelize, sequelize, Dataset } = require('../models');
const _ = require('lodash');
const fs = require('fs');
const https = require('https');
const CronJob = require('cron').CronJob;
require('console-stamp')(console);
const axios = require('axios').create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
    cert: fs.readFileSync('./cron_datasets/usercert.pem'),
    key: fs.readFileSync('./cron_datasets/userkey.pem'),
    passphrase: 'passphrase',
  }),
});
const { default: PQueue } = require('p-queue');
const splitRegex = require('./pinging_utils').splitRegex;
const { handleErrors } = require('../utils/error_handlers');
const {
  API_URL,
  DQM_GUI_URL,
  SECONDS_PER_DQM_GUI_CHECK,
} = require('../config/config')[process.env.ENV || 'development'];
const { update_or_create_dataset } = require('../controllers/dataset');
const { create_new_version } = require('../controllers/version');

const { Op } = Sequelize;

/**
 * Queue to make sure the promises don't explode the event loop. We want to run only 2 at the same time
 */
const queue = new PQueue({ concurrency: 2 });

/**
 * Fetches All the GUI datasets using a regular expression '*.' and returns them in an object grouped by run number.
 * If in development it will just load the GUI datasets from a file, else it will perform an http request.
 * @return An object with run numbers as keys, in which every run number key contains all the datasets in the gui for that run number
 */
const get_all_datasets_in_gui = async () => {
  let all_datasets_in_gui;
  if (process.env.NODE_ENV === 'production') {
    console.log('fetching all GUI data');
    const { data } = await axios.get(`${DQM_GUI_URL}*.`);
    console.log('all GUI data fetched');
    all_datasets_in_gui = data;
  } else {
    all_datasets_in_gui = JSON.parse(
      fs.readFileSync('./cron_datasets/full_gui_sample.json', 'utf8')
    );
  }
  // The response from dqm gui comes like this, therefore, we need to parse it in the following line:
  //{
  //      samples: [
  //          {
  //              type: "offline_data",
  //              items: [
  //                  {
  //                      type: "offline_data",
  //                      run: "271861",
  //                      dataset: "/Cosmics/Run2016B-PromptReco-v1/DQMIO",
  //                      version: "",
  //                      importversion: 1
  //                  },
  //                  {
  //                      ...
  //                  }
  //              ]
  //      ]
  //}
  all_datasets_in_gui = all_datasets_in_gui.samples[0].items;

  const run_numbers_dataset = {};
  all_datasets_in_gui.forEach(({ run, dataset }) => {
    if (typeof run_numbers_dataset[run] === 'undefined') {
      run_numbers_dataset[run] = [dataset];
    } else {
      run_numbers_dataset[run].push(dataset);
    }
  });
  return run_numbers_dataset;
};

/**
 * Fetches all the datasets in Run Registry
 * @return All the datasets in run registry with the column of 'datasets_in_gui'
 */
const get_all_datasets_in_rr = async () => {
  return await Dataset.findAll({
    where: {
      name: { [Op.ne]: 'online' },
    },
    attributes: ['run_number', 'name', 'datasets_in_gui'],
    order: [
      ['run_number', 'ASC'],
      ['name', 'ASC'],
    ],
  });
};

/**
 * Gets all the datasets accepted by RR
 * @return the datasets accepted grouped by the name of the dataset
 */
const get_datasets_accepted = async () => {
  const { data: datasets_accepted } = await axios.get(
    `${API_URL}/datasets_accepted`
  );

  return _.chain(datasets_accepted).groupBy('name').value();
};

/**
 * Goes through all the datasets in RR, and compares them with all the datasets in the gui, if there are new datasets in the GUI it creates a new event to make sure that they are in RR
 */
const ping_dqm_gui = async () => {
  await sequelize.sync({});
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { atomic_version } = await create_new_version({
      req: { email: 'auto@auto' },
      transaction,
      comment: 'new dataset appeared pinging gui',
    });
    const datasets_accepted = await get_datasets_accepted();
    const all_datasets_in_rr = await get_all_datasets_in_rr();
    const all_datasets_in_gui = await get_all_datasets_in_gui();

    let count_of_dataset_links_added_in_gui = 0;
    const promises = all_datasets_in_rr.map(
      ({ run_number, name, datasets_in_gui }) => async () => {
        const datasets_accepted_by_name = datasets_accepted[name] || [];
        const current_datasets_in_gui =
          all_datasets_in_gui[`${run_number}`] || [];
        const future_datasets_in_gui = new Set();
        datasets_accepted_by_name.forEach(
          ({ regexp, enabled, run_from, run_to }) => {
            if (enabled && run_from <= run_number && run_number <= run_to) {
              const regexs = splitRegex(regexp);
              regexs.forEach((regexp) => {
                regexp = new RegExp(regexp.trim());
                current_datasets_in_gui.forEach((dataset_in_gui) => {
                  if (
                    regexp.test(dataset_in_gui) &&
                    !datasets_in_gui.includes(dataset_in_gui)
                  ) {
                    future_datasets_in_gui.add(dataset_in_gui);
                  }
                });
              });
            }
          }
        );
        if (future_datasets_in_gui.size > 0) {
          // insert into DB:
          await update_or_create_dataset({
            dataset_name: name,
            run_number,
            dataset_metadata: {},
            datasets_in_gui: Array.from(future_datasets_in_gui),
            atomic_version,
            transaction,
          });
          count_of_dataset_links_added_in_gui += future_datasets_in_gui.length;
        }
      }
    );
    await queue.addAll(promises);
    if (count_of_dataset_links_added_in_gui > 0) {
      console.log(`Added ${count_of_dataset_links_added_in_gui} dataset links`);
      await transaction.commit();
    } else {
      await transaction.rollback();
    }
    console.log(
      'finished job of fecthing all GUI datasets and comparing them with RR'
    );
  } catch (err) {
    console.log(err.message);
    await transaction.rollback();
  }
};

// Cron job starts:
if (process.env.NODE_ENV !== 'development') {
  const job = new CronJob(
    `*/${SECONDS_PER_DQM_GUI_CHECK} * * * * *`,
    handleErrors(ping_dqm_gui, 'Error pinging DQM GUI')
  ).start();
} else {
  // For development:
  setTimeout(() => {
    // We wait until the
    ping_dqm_gui();
  }, 3000);
}
