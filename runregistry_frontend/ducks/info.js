import axios from 'axios';
const INITIAL_INFO = 'INITIAL_INFO';
const INITIALIZE_ENVIRONMENT = 'INITIALIZE_ENVIRONMENT';

export const initializeUser = (store, query) => {
    store.dispatch({
        type: INITIAL_INFO,
        payload: query
    });
};

export const initializeEnvironment = store => {
    store.dispatch({
        type: INITIALIZE_ENVIRONMENT,
        payload: process.env.ENV
    });
};

const INITIAL_STATE = {};

export default function info(state = INITIAL_STATE, action) {
    const { type, payload } = action;
    switch (type) {
        case INITIAL_INFO:
            const { displayname, email, egroups, id, cookie } = payload;
            return {
                ...state,
                displayname,
                email,
                egroups,
                id,
                // For use with OAUTH middleware:
                cookie
            };
        case INITIALIZE_ENVIRONMENT:
            return { ...state, environment: payload };
        default:
            return state;
    }
}
