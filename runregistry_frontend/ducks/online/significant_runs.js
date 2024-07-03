import axios from 'axios';
const CancelToken = axios.CancelToken;
let cancel;

import { api_url } from '../../config/config';
import auth from '../../auth/auth';
import { error_handler } from '../../utils/error_handlers';
import { hideManageRunModal } from './ui';
import { EDIT_RUN } from './runs';
const FILTER_RUNS = 'FILTER_SIGNIFICANT_RUNS';

export const filterRuns = (page_size, page, sortings, filtered) =>
  error_handler(
    async (dispatch, getState) => {
      if (cancel) {
        cancel();
      }
      const { data: runs } = await axios.post(
        `${api_url}/runs_filtered_ordered`,
        {
          page,
          page_size,
          sortings,
          filter: { ...filtered, 'rr_attributes.significant': true }
        },
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

const INITIAL_STATE = {
  runs: []
};

export default function significant_runs(state = INITIAL_STATE, action) {
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
