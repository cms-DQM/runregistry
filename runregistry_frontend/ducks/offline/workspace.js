process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import axios from 'axios';
import { api_url } from '../../config/config';
import { error_handler } from '../../utils/error_handlers';
import auth from '../../auth/auth';

const FETCH_WORKSPACES = 'FETCH_WORKSPACES-OFFLINE';
export const CHANGE_WORKSPACE = 'CHANGE_WORKSPACE-OFFLINE';
const ADD_COLUMN = 'ADD_COLUMN-OFFLINE';
const REMOVE_COLUMN = 'REMOVE_COLUMN-OFFLINE';

export const fetchWorkspaces = ({ workspace }) =>
    error_handler(async (dispatch, getState) => {
        const { data: workspaces } = await axios.get(
            `${api_url}/workspaces/offline`
        );
        dispatch({
            type: FETCH_WORKSPACES,
            payload: workspaces
        });
        dispatch({
            type: CHANGE_WORKSPACE,
            payload: workspace
        });
    });

export const addColumn = (workspace, column) =>
    error_handler(async (dispatch, getState) => {
        const { data: workspaces } = await axios.post(
            `${api_url}/workspaces/offline`,
            { workspace, column },
            auth(getState)
        );
        dispatch({
            type: ADD_COLUMN,
            payload: workspaces
        });
        // fetch table again
    });

export const removeColumn = (workspace, column) =>
    error_handler(async (dispatch, getState) => {
        const { data: workspaces } = await axios.delete(
            `${api_url}/workspaces/offline`,
            auth(getState)
        );
        dispatch({
            type: REMOVE_COLUMN,
            payload: workspaces
        });
        // fetch table again
    });

const INITIAL_STATE = { workspace: 'global', workspaces: [] };

export default function workspace(state = INITIAL_STATE, action) {
    const { type, payload } = action;
    switch (type) {
        case FETCH_WORKSPACES:
            return { ...state, workspaces: payload };
        case CHANGE_WORKSPACE:
            return { ...state, workspace: payload };
        case ADD_COLUMN:
            return { ...state, workspaces: payload };
        case REMOVE_COLUMN:
            return { ...state, workspaces: payload };
        default:
            return state;
    }
}
