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
// See https://github.com/cms-DQM/runregistry/pull/21
export const editRun = (run_number, updated_run) =>
  error_handler(async (dispatch, getState) => {
    let failed_attributes = [];
    let first_req_failed = false;
    let run;
    try {
      await axios.put(
        `${api_url}/manual_run_edit/${run_number}/class`,
        { "class": updated_run.rr_attributes.class },
        auth(getState)
      );
    } catch (err) {
      const { status } = err.response;

      first_req_failed = true;
      if (status === 401) {
        failed_attributes.push("class")
      }
      // If any other non-authorized error happens, pass it to the error_handler
      else {
        throw err;
      }
    }

    try {
      // Parentheses needed to destructure data to existing run var, 
      // which is outside of try-catch.
      ({ data: run } = await axios.put(
        `${api_url}/manual_run_edit/${run_number}/stop_reason`,
        { "stop_reason": updated_run.rr_attributes.stop_reason },
        auth(getState)
      ));
    } catch (err) {
      const { status } = err.response;
      // Both requests failed, error
      if (first_req_failed) {
        throw err;
      }
      if (status === 401) {
        failed_attributes.push("stop reason")
      } else {
        throw err;
      }
    }

    run = formatRuns([run])[0];
    dispatch({ type: EDIT_RUN, payload: run });
    dispatch(hideManageRunModal());
    return failed_attributes;
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
