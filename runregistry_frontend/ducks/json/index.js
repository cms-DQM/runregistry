import { combineReducers } from 'redux';
import configuration from './configuration';
import datasets from './datasets';
import jsons from './jsons';
import ui from './ui';

const jsonRootReducer = combineReducers({
  configuration,
  datasets,
  jsons,
  ui,
});

export default jsonRootReducer;
