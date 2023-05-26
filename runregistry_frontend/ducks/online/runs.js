import axios from 'axios';
const CancelToken = axios.CancelToken;
let cancel;

import { api_url } from '../../config/config';
import auth from '../../auth/auth';
import { error_handler } from '../../utils/error_handlers';
import { hideManageRunModal } from './ui';
export const EDIT_RUN = 'EDIT_RUN';
const FILTER_RUNS = 'FILTER_RUNS';
const INITIALIZE_FILTERS = 'INITIALIZE_FILTERS';

export const filterRuns = (page_size, page, sortings, filter) =>
  error_handler(
    async (dispatch, getState) => {
      if (cancel) {
        cancel();
      }
      const { data: runs } = await axios.post(
        `${api_url}/runs_filtered_ordered`,
        { page, page_size, sortings, filter },
        {
          cancelToken: new CancelToken(function executor(c) {
            cancel = c;
          })
        },
        auth(getState)
      );
      runs.runs = formatRuns(runs.runs);
      dispatch({
        type: FILTER_RUNS,
        payload: runs
      });
    },
    false,
    false
  );



// Callback when submitting updated run info (class and stop_reason). Initially, it was done
// through a single API route, meaning that there was a single Permission tied
// to this action. Later, it was decided that only experts can change the run class,
// so the API route had to be split to two separate ones: one for changing the class
// and the other for changing the stop reason. In order not to change the UI, a single form is
// used, but two separate requests are made.
// This leads us to have to check if any of the two succeeded:
// if only one succeeded, this means that the request was partially successful, but,
// due to missing permissions, you could not change all the run attributes. In order
// not to show a scary warning message to the shifters, partial success is still 
// shown as success, but with a message on what attribute failed to update.
// A workaround would be to have separate forms for updating each attribute.  
export const editRun = (run_number, updated_run) =>
  error_handler(async (dispatch, getState) => {
    let warnings = [];
    let first_req_failed = false;
    let response_class, response_stop_reason;
    try {
      let { data: run } = await axios.put(
        `${api_url}/manual_run_edit/${run_number}/class`,
        { "class": updated_run.rr_attributes.class },
        auth(getState)
      );
      response_class = run;
    } catch (err) {
      const { status, statusText } = err.response;

      console.warn(err);
      first_req_failed = true;
      // warnings.push(err.response.data.message);
      warnings.push(`Could not update run class. You may not have the required permissions.`)
    }

    try {
      let { data: run } = await axios.put(
        `${api_url}/manual_run_edit/${run_number}/stop_reason`,
        { "stop_reason": updated_run.rr_attributes.stop_reason },
        auth(getState)
      );
      response_stop_reason = run;
    } catch (err) {
      const { status, statusText } = err.response;
      console.warn(err);
      // Both requests failed, error
      if (first_req_failed) {
        throw err;
      }
      // warnings.push(err.response.data.message);
      warnings.push(`Could not update run stop reason. You may not have the required permissions.`)
    }

    let run = response_stop_reason;
    run = formatRuns([run])[0];
    dispatch({ type: EDIT_RUN, payload: run });
    dispatch(hideManageRunModal());
    return warnings;
  });

export const markSignificant = run_number =>
  error_handler(async (dispatch, getState) => {
    let { data: run } = await axios.post(
      `${api_url}/runs/mark_significant`,
      { run_number },
      auth(getState)
    );
    run = formatRuns([run])[0];
    dispatch({ type: EDIT_RUN, payload: run });
  });

export const moveRun = (run_number, from_state, to_state) =>
  error_handler(async (dispatch, getState) => {
    let { data: run } = await axios.post(
      `${api_url}/runs/move_run/${from_state}/${to_state}`,
      { run_number },
      auth(getState)
    );
    run = formatRuns([run])[0];
    dispatch({ type: EDIT_RUN, payload: run });
  });

// refreshRun will refresh the lumisections inside the run from OMS
export const refreshRun = run_number =>
  error_handler(async (dispatch, getState) => {
    let { data: run } = await axios.post(
      `${api_url}/runs/refresh_run/${run_number}`,
      {},
      auth(getState)
    );
    run = formatRuns([run])[0];
    dispatch({ type: EDIT_RUN, payload: run });
    return run;
  });

export const resetAndRefreshRun = run_number =>
  error_handler(async (dispatch, getState) => {
    let { data: run } = await axios.post(
      `${api_url}/runs/reset_and_refresh_run/${run_number}`,
      {},
      auth(getState)
    );
    run = formatRuns([run])[0];
    dispatch({ type: EDIT_RUN, payload: run });
    return run;
  });

// reFetch run will just refetch a run
export const reFetchRun = run_number =>
  error_handler(async (dispatch, getState) => {
    let { data: run } = await axios.get(
      `${api_url}/runs/${run_number}`,
      {},
      auth(getState)
    );
    run = formatRuns([run])[0];
    dispatch({ type: EDIT_RUN, payload: run });
    return run;
  });

const INITIAL_STATE = {
  runs: [],
  pages: 0,
  count: 0
};

export default function (state = INITIAL_STATE, action) {
  const { type, payload } = action;
  switch (type) {
    case FILTER_RUNS:
      return {
        ...state,
        runs: payload.runs,
        pages: payload.pages,
        count: payload.count
      };
    case EDIT_RUN:
      return { ...state, runs: editRunHelper(state.runs, payload) };
    default:
      return state;
  }
}

const findId = (array, run_number) => {
  for (let i = 0; i < array.length; i++) {
    if (array[i].run_number === run_number) {
      return i;
    }
  }
};

const editRunHelper = (runs, new_run) => {
  const index = findId(runs, new_run.run_number);
  if (typeof index !== 'undefined') {
    return [...runs.slice(0, index), new_run, ...runs.slice(index + 1)];
  }
  return runs;
};

const formatRuns = runs => {
  return runs.map(run => ({
    ...run.oms_attributes,
    ...run.rr_attributes,
    ...run,
    triplet_summary: run.DatasetTripletCache
      ? run.DatasetTripletCache.triplet_summary
      : {}
  }));
};
