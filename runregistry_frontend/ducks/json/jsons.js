import axios from 'axios';
import stringify from 'json-stringify-pretty-compact';
import auth from '../../auth/auth';
import { error_handler } from '../../utils/error_handlers';
import { api_url } from '../../config/config';
import Swal from 'sweetalert2';

const FETCH_JSONS = 'FETCH_JSONS';
const FETCH_MORE_JSONS = 'FETCH_MORE_JSONS';
const UPDATE_PROGRESS = 'UPDATE_PROGRESS';
const MORE_JSONS = 'MORE_JSONS';
const DELETE_JSON = 'DELETE_JSON';

export const getJsons = (selected_tab) =>
  error_handler(async (dispatch, getState) => {
    const { data } = await axios.post(
      `${api_url}/json_portal/jsons`,
      {
        filter: selected_tab,
      },
      auth(getState)
    );
    const jsons = data.jsons.filter((json) => json !== null);
    dispatch({
      type: FETCH_JSONS,
      payload: jsons,
    });
  });

export const deleteJson = (id_json) =>
  error_handler(async (dispatch, getState) => {
    const { headers } = auth(getState);
    const { data } = await axios.delete(`${api_url}/json_portal/json`, {
      headers,
      data: { id_json },
    });
    await Swal(`JSON deleted`, '', 'success');
    dispatch({
      type: DELETE_JSON,
      payload: data.deleted_json,
    });
  });

export const fetchMoreJsons = (selected_tab, reference) =>
  error_handler(async (dispatch, getState) => {
    const { data } = await axios.post(
      `${api_url}/json_portal/jsons`,
      {
        filter: selected_tab,
        reference,
      },
      auth(getState)
    );
    const jsons = data.jsons.filter((json) => json !== null);
    if (jsons.length === 0) {
      dispatch({ type: MORE_JSONS });
    }
    dispatch({
      type: FETCH_MORE_JSONS,
      payload: jsons,
    });
  });

export const updateProgress = (event) => ({
  type: UPDATE_PROGRESS,
  payload: event,
});

const INITIAL_STATE = {
  more_jsons: true,
  jsons: [],
  deleted_jsons: [],
};

export default function jsons(state = INITIAL_STATE, action) {
  const { type, payload } = action;

  switch (type) {
    case FETCH_JSONS:
      return {
        ...state,
        jsons: payload,
        more_jsons: true,
      };
    case UPDATE_PROGRESS:
      return { ...state, jsons: [...updateProgressHelper(state, payload)] };
    case FETCH_MORE_JSONS:
      return { ...state, jsons: [...state.jsons, ...payload] };
    case MORE_JSONS:
      return { ...state, more_jsons: false };
    case DELETE_JSON:
      return { ...state, deleted_jsons: [...state.deleted_jsons, payload] };
    default:
      return state;
  }
}

function updateProgressHelper(jsons, event) {
  const { id, progress } = event;
  const result = jsons.map((json) => {
    if (json.id === id) {
      return { ...json, progress };
    }
    return { ...json };
  });
  return result;
}
