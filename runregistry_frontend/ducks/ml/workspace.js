import axios from 'axios';
import { api_url } from '../../config/config';
import { error_handler } from '../../utils/error_handlers';
import auth from '../../auth/auth';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const FETCH_WORKSPACES = 'FETCH_WORKSPACES-ML';
export const CHANGE_WORKSPACE = 'CHANGE_WORKSPACE-ML';
const ADD_COLUMN = 'ADD_COLUMN-ML';
const REMOVE_COLUMN = 'REMOVE_COLUMN-ML';

export const fetchWorkspaces = ({ workspace }) =>
  error_handler(async (dispatch, getState) => {
    // We still have the same workspaces as offline:
    const { data: workspaces } = await axios.get(
      `${api_url}/workspaces/offline`
    );
    dispatch({
      type: FETCH_WORKSPACES,
      payload: workspaces,
    });
    dispatch({
      type: CHANGE_WORKSPACE,
      payload: workspace,
    });
  });

const INITIAL_STATE = { workspace: 'global', workspaces: [] };

export default function (state = INITIAL_STATE, action) {
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
