const CronJob = require('cron').CronJob;
const axios = require('axios');
const { handleErrors } = require('../utils/error_handlers');
const { getToken } = require('./get_token');
const https = require('https');
const config = require('../config/config');
const {
  OMS_URL,
  OMS_RUNS,
  OMS_GET_RUNS_CRON_ENABLED,
  API_URL,
  RUNS_PER_API_CALL,
  SECONDS_PER_API_CALL,
} = config[process.env.ENV || 'development'];
const { save_runs, update_runs } = require('./2.save_or_update_runs');

let headers;
const instance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
});

// Will call itself recursively if all runs are new
const fetch_runs = async (
  fetch_amount = RUNS_PER_API_CALL,
  first_time = true
) => {
  const oms_url = `${OMS_URL}/${OMS_RUNS(fetch_amount)}`;
  // insert cookie that will authenticate OMS request:

  if (first_time) {
    headers = {
      Authorization: `Bearer ${await getToken()}`,
    };
  }
  if (!first_time) {
    // We sleep for 2 seconds not to degrade OMS API (if it is not first time):
    await new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });
  }

  const oms_response = await instance.get(oms_url, {
    headers,
  });
  if (typeof oms_response.data.data === 'undefined') {
    throw Error('Invalid token in request');
  }
  // Extract attributes from OMS response
  let all_fetched_runs = oms_response.data.data.map(
    ({ attributes }) => attributes
  );

  // all_fetched_runs is an accumulation of all latest updated runs,
  // we need to slice it to get the actually new runs in the corresponding request
  let fetched_runs = first_time
    ? all_fetched_runs
    : all_fetched_runs.slice(fetch_amount / 2);
  console.debug("Querying the last 50 updated OMS runs")
  const { data: last_saved_runs } = await axios.get(
    `${API_URL}/runs_lastupdated_50`
  );
  const new_runs = calculate_new_runs(fetched_runs, last_saved_runs);

  // If all runs are new, it means there might've been other previous runs which have not been saved (the arrays are not equal in length)
  // Therefore, it is good to call recursively until at least some run that is fetched was previously fetched and saved, and then save them all.
  if (new_runs.length === fetched_runs.length) {
    console.log(
      `cron/1.get_runs.js # fetch_runs(): All fetched runs are new, fetching ${fetch_amount * 2} runs...`
    );
    await fetch_runs(fetch_amount * 2, false);
  } else {
    // Here we calculate the new_runs with ALL runs, instead of above with only the fetched runs:
    const runs_to_be_saved = calculate_new_runs(all_fetched_runs, last_saved_runs);

    if (runs_to_be_saved.length > 0) {
      console.log(`cron/1.get_runs.js # fetch_runs(): saving: ${runs_to_be_saved.length} runs`);
      // The 0 in the second argument is to indicate is this the first time we try to save the runs (save_runs is recursive if it errors out on any run)
      await save_runs(runs_to_be_saved, 0);
    }
  }

  // Check for runs to update (only on first time of the cron cycle):
  if (first_time) {
    const runs_to_update = calculate_runs_to_update(
      fetched_runs,
      last_saved_runs
    );
    if (runs_to_update.length > 0) {
      update_runs(runs_to_update, 0, {});
    }
  }
};

if (OMS_GET_RUNS_CRON_ENABLED === true) {
  const job = new CronJob(
    `*/${SECONDS_PER_API_CALL} * * * * *`,
    handleErrors(fetch_runs, 'cron/1.get_runs.js # Error fetching new runs ')
  ).start();
}
// If in a dev environment we want to do this at least once:
handleErrors(fetch_runs, 'cron/1.get_runs.js # Error fetching new runs ')();

// makes left outer join between fetched_runs and last_saved_runs, returns the difference of runs (the ones which have not been saved)
// Case when run from way in the past is upated, it will think it is a new run, since it doesn't appear in the fetch of the local 50 runs,
// This function only returns new runs,
const calculate_new_runs = (fetched_runs, existing_runs) => {
  // Keep track of new runs we received from OMS
  const new_runs = [];
  const min_run_number = get_min_run_number(existing_runs);

  fetched_runs.forEach((fetched_run) => {
    // Check if it exists in the already saved runs:
    let exists = existing_runs.some(existing_run => {
      +fetched_run.run_number === existing_run.run_number
    });
    // If it does not exist in alreay saved runs, check if it exists in the recently created array.
    if (!exists) {
      let already_saved = new_runs.some((run) => {
        +fetched_run.run_number === +run.run_number
      });

      if (!already_saved) {
        // If the run_number of the run is way in the past (prior to the last of the already saved runs) then this is not a new run, but a run to update
        // min_run_number is the oldest run_number saved (aka the minimum possible run number from the sample fetched):
        if (+fetched_run.run_number > min_run_number) {
          new_runs.push(fetched_run);
        }
      }
    }
  });
  return new_runs;
};

// If a Run has an attribute which changed from OMS, it will run every classifier, and will update the run
const calculate_runs_to_update = (fetched_runs, last_saved_runs) => {
  const runs_to_update = [];
  const min_run_number = get_min_run_number(last_saved_runs);
  fetched_runs.forEach((fetched_run) => {
    // If the run_number is less than the minimum of the already saved runs, then it is one from the past, which needs to be updated. Else we compare timestamps
    if (fetched_run.run_number < min_run_number) {
      if (fetched_run.run_number > MINIMUM_CMS_RUN_NUMBER) {
        runs_to_update.push(fetched_run);

      } else {
        console.log(`Run number ${fetched_run.run_number} is lower than the threshold MINIMUM_CMS_RUN_NUMBER (${MINIMUM_CMS_RUN_NUMBER}), ignoring`)
      }
    } else {
      // If the run_number is inside the existing already saved runs, then we check for the timestamp:
      last_saved_runs.forEach((existing_run) => {
        // if runs are the same (i.e. same run_number), check last_update
        if (+fetched_run.run_number === +existing_run.run_number) {
          const last_updated_existing_run = new Date(
            existing_run.oms_attributes.last_update
          );
          const last_updated_fetched_run = new Date(fetched_run.last_update);
          // If the last_update of fetched run is greater than that of previously saved run, we need to update the run
          if (last_updated_fetched_run > last_updated_existing_run) {
            runs_to_update.push(fetched_run);
          } else if (
            fetched_run.end_time !== existing_run.oms_attributes.end_time
          ) {
            // We also check if the end_time differs (since currently the last_update from OMS doesn't contemplate it)
            runs_to_update.push(fetched_run);
          }
        }
      });
    }
  });
  return runs_to_update;
};

const get_min_run_number = (array_of_runs) => {
  const min_run_number = array_of_runs.reduce(
    (min_run_number, run) =>
      run.run_number < min_run_number ? run.run_number : min_run_number,
    array_of_runs[0] ? array_of_runs[0].run_number : -1
  );
  return min_run_number;
};

const get_max_run_number = (array_of_runs) => {
  const max_run_number = array_of_runs.reduce(
    (max_run_number, run) =>
      run.run_number > max_run_number ? run.run_number : max_run_number,
    array_of_runs[0] ? array_of_runs[0].run_number : 300000 * 10
  );
  return max_run_number;
};





