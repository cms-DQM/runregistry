import axios from 'axios';
import { api_url } from '../../config/config';
import { error_handler } from '../../utils/error_handlers';
import auth from '../../auth/auth';

const FETCH_DATASETS_ACCEPTED = 'FETCH_DATASETS_ACCEPTED';
const ADD_DATASET_ACCEPTED = 'ADD_DATASET_ACCEPTED';
const REMOVE_DATASET_ACCEPTED = 'REMOVE_DATASET_ACCEPTED';
const EDIT_DATASET_ACCEPTED = 'EDIT_DATASET_ACCEPTED';

export const fetchDatasetsAccepted = () =>
    error_handler(async dispatch => {
        const { data: datasets_accepted } = await axios.get(
            `${api_url}/datasets_accepted`
        );
        dispatch({
            type: FETCH_DATASETS_ACCEPTED,
            payload: datasets_accepted
        });
    });

export const addRegexp = new_regexp =>
    error_handler(async (dispatch, getState) => {
        const { data: dataset_accepted } = await axios.post(
            `${api_url}/datasets_accepted`,
            new_regexp,
            auth(getState)
        );
        dispatch({
            type: ADD_DATASET_ACCEPTED,
            payload: dataset_accepted
        });
    });

export const editRegexp = edited_regexp =>
    error_handler(async (dispatch, getState) => {
        const { data: dataset_accepted } = await axios.put(
            `${api_url}/datasets_accepted/${edited_regexp.id}`,
            edited_regexp,
            auth(getState)
        );
        dispatch({
            type: EDIT_DATASET_ACCEPTED,
            payload: dataset_accepted
        });
    });

export const removeRegexp = id_dataset_accepted =>
    error_handler(async (dispatch, getState) => {
        const { data: dataset_accepted } = await axios.delete(
            `${api_url}/datasets_accepted/${id_dataset_accepted}`,
            auth(getState)
        );
        dispatch({
            type: REMOVE_DATASET_ACCEPTED,
            payload: dataset_accepted.id
        });
    });

const INITIAL_STATE = [];

export default function datasets_accepted(state = INITIAL_STATE, action) {
    const { type, payload } = action;
    switch (type) {
        case FETCH_DATASETS_ACCEPTED:
            return payload;
        case ADD_DATASET_ACCEPTED:
            return state.concat(payload);
        case REMOVE_DATASET_ACCEPTED:
            return deleteDatasetAcceptedHelper(state, payload);
        case EDIT_DATASET_ACCEPTED:
            return editDatasetAcceptedHelper(state, payload);
        default:
            return state;
    }
}

const findId = (datasets_accepted, id) => {
    for (let i = 0; i < datasets_accepted.length; i++) {
        if (datasets_accepted[i].id === id) {
            return i;
        }
    }
};

const deleteDatasetAcceptedHelper = (datasets_accepted, id) => {
    const index = findId(datasets_accepted, id);
    return [
        ...datasets_accepted.slice(0, index),
        ...datasets_accepted.slice(index + 1)
    ];
};

const editDatasetAcceptedHelper = (datasets_accepted, dataset_accepted) => {
    const index = findId(datasets_accepted, dataset_accepted.id);
    return [
        ...datasets_accepted.slice(0, index),
        dataset_accepted,
        ...datasets_accepted.slice(index + 1)
    ];
};
