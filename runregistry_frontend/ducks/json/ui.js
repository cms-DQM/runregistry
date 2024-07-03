import { error_handler } from '../../utils/error_handlers';

const SHOW_MODAL = 'SHOW_MODAL-JSON';
export const HIDE_MODAL = 'HIDE_MODAL-JSON';
const SELECT_DATASET_TO_VISUALIZE = 'SELECT_DATASET_TO_VISUALIZE';
const SELECT_JSON_FROM_LIST = 'SELECT_JSON_FROM_LIST';

export const showModal = (modal_type) => ({
  type: SHOW_MODAL,
  payload: modal_type,
});

export const hideModal = () => ({
  type: HIDE_MODAL,
});

export const selectJson = (json) => ({
  type: SELECT_JSON_FROM_LIST,
  payload: json,
});

export const visualizeDataset = (dataset, included_in_json) =>
  error_handler(async (dispatch) => {
    dataset = {
      dataset: {
        name: dataset.name,
        // missing dataset_attributes
      },
      run: {
        run_number: dataset.run_number,
        rr: dataset.Run.rr_attributes,
        oms: dataset.Run.oms_attributes,
      },
      lumisection: {
        oms: transformTripletCacheToBoolean(
          dataset.DatasetTripletCache.dcs_summary
        ),
        rr: transformTripletCacheToBoolean(
          dataset.DatasetTripletCache.triplet_summary
        ),
      },
    };
    dispatch({
      type: SELECT_DATASET_TO_VISUALIZE,
      payload: { dataset, included_in_json },
    });
    dispatch(showModal('visualize_json'));
  });

const transformTripletCacheToBoolean = (contained_summary) => {
  const boolean_summary = {};
  for (const [column, summary] of Object.entries(contained_summary)) {
    boolean_summary[column] = {};
    for (const [value, count] of Object.entries(summary)) {
      if (count > 0) {
        boolean_summary[column][value] = true;
      } else {
        boolean_summary[column][value] = false;
      }
    }
  }
  return boolean_summary;
};

const INITIAL_STATE = {
  modal_visible: false,
  modal_type: '',
  selected_dataset_to_visualize: {},
  dataset_included_in_json: false,
  selected_json: {},
};

export default function ui(state = INITIAL_STATE, action) {
  const { type, payload } = action;
  switch (type) {
    case SHOW_MODAL:
      return {
        ...state,
        modal_visible: true,
        modal_type: payload,
      };
    case HIDE_MODAL:
      return {
        ...state,
        modal_visible: false,
        modal_type: '',
      };
    case SELECT_DATASET_TO_VISUALIZE:
      return {
        ...state,
        selected_dataset_to_visualize: payload.dataset,
        dataset_included_in_json: payload.included_in_json,
      };
    case SELECT_JSON_FROM_LIST:
      return { ...state, selected_json: payload };
    default:
      return state;
  }
}
