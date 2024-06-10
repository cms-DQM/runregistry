// This is a microservice, it works independently from the API, it doesn't share computer resources and so it doesn't impact the performance of the API
const {
  Sequelize,
  sequelize,
  Dataset,
  Run,
  DatasetTripletCache,
} = require('../models');
const _ = require('lodash');
const fs = require('fs');
const https = require('https');
const CronJob = require('cron').CronJob;
const axios = require('axios').create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
    cert: fs.readFileSync('./certs/usercert.pem'),
    key: fs.readFileSync('./certs/userkey.pem'),
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
  WAITING_DQM_GUI_CONSTANT,
  DQM_GUI_PING_CRON_ENABLED
} = require('../config/config')[process.env.ENV || 'development'];
const { update_or_create_dataset } = require('../controllers/dataset');
const { create_new_version } = require('../controllers/version');
const json_logic = require('json-logic-js');
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
    console.log('cron_datasets/2.ping_dqm_gui.js # get_all_datasets_in_gui(): fetching all GUI data');
    const { data } = await axios.get(`${DQM_GUI_URL}*.`);
    console.log('cron_datasets/2.ping_dqm_gui.js # get_all_datasets_in_gui(): all GUI data fetched');
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
    attributes: ['run_number', 'name', 'dataset_attributes', 'datasets_in_gui'],
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

const get_offline_dataset_classifiers = async () => {
  const { data: offline_dataset_classifiers } = await axios.get(`
  ${API_URL}/classifiers/offline_dataset`);
  return offline_dataset_classifiers;
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
    const offline_dataset_classifiers = await get_offline_dataset_classifiers();

    let count_of_dataset_links_added_in_gui = 0;
    const promises = all_datasets_in_rr.map(
      ({ run_number, name, dataset_attributes, datasets_in_gui }) =>
        async () => {
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
            const new_states = {};
            // We get the full dataset to apply the classifier (with Run and DatasetTripletCache)
            const this_dataset = await Dataset.findOne({
              where: { name, run_number },
              include: [{ model: Run }, { model: DatasetTripletCache }],
            });
            // Insert new state for datasets which appeared:
            for (const [key, val] of Object.entries(dataset_attributes)) {
              if (key.endsWith('_state') && val === WAITING_DQM_GUI_CONSTANT) {
                const workspace = key.split('_state')[0];
                const classifier_for_workspace =
                  offline_dataset_classifiers.find((classifier) => {
                    return classifier.workspace === workspace;
                  });
                if (!classifier_for_workspace) {
                  console.error(
                    `There is no offline dataset classifier for workspace ${workspace} therefore we cannot move it down.`
                  );
                  continue;
                } else {
                  const classifier = JSON.parse(
                    classifier_for_workspace.classifier
                  );
                  if (json_logic.apply(classifier, this_dataset)) {
                    new_states[key] = 'OPEN';
                  } else {
                    // If it didn't pass the json logic test from the dataset classifier, we set it to not significant for worspace (example: Express for many workspaces)
                    new_states[key] = 'not significant for workspace';
                  }
                }
              }
            }
            // insert into DB:
            await update_or_create_dataset({
              dataset_name: name,
              run_number,
              dataset_metadata: new_states,
              datasets_in_gui: Array.from(future_datasets_in_gui),
              atomic_version,
              transaction,
            });
            count_of_dataset_links_added_in_gui += future_datasets_in_gui.size;
          }
        }
    );
    await queue.addAll(promises);
    if (count_of_dataset_links_added_in_gui > 0) {
      console.log(`cron_datasets/2.ping_dqm_gui.js # ping_dqm_gui(): Added ${count_of_dataset_links_added_in_gui} dataset links`);
      await transaction.commit();
    } else {
      await transaction.rollback();
    }
    console.log(
      'cron_datasets/2.ping_dqm_gui.js # ping_dqm_gui(): finished job of fetching all GUI datasets and comparing them with RR'
    );
  } catch (err) {
    console.log('cron_datasets/2.ping_dqm_gui.js # ping_dqm_gui(): ERROR: ', err.message);
    await transaction.rollback();
  }
};

// Cron job starts:
if (DQM_GUI_PING_CRON_ENABLED === true) {
  const job = new CronJob(
    `*/${SECONDS_PER_DQM_GUI_CHECK} * * * * *`,
    handleErrors(ping_dqm_gui, 'cron_datasets/2.ping_dqm_gui.js # Error pinging DQM GUI')
  ).start();
} else {
  // Runs only once on start
  setTimeout(() => {
    ping_dqm_gui();
  }, 3000);
}
