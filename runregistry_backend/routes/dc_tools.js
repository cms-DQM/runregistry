const { catchAPIError: catchAPI } = require('../utils/error_handlers');
const auth = require('../auth/authenticate');
const Dataset = require('../controllers/dataset');

module.exports = app => {
  app.post(
    '/dc_tools/unique_dataset_names',
    catchAPI(Dataset.getUniqueDatasetNames)
  );
  app.post(
    '/dc_tools/duplicate_datasets',
    auth,
    catchAPI(Dataset.duplicate_datasets)
  );
  app.post(
    '/dc_tools/change_multiple_dataset_states_in_all_workspaces/:to_state',
    auth,
    catchAPI(Dataset.change_multiple_states_in_all_workspaces)
  );
  app.post(
    '/dc_tools/change_multiple_dataset_states/:workspace_to_change_state_in/:from_state/:to_state',
    auth,
    catchAPI(Dataset.change_multiple_states)
  );
  app.post(
    '/dc_tools/copy_column_from_datasets',
    auth,
    catchAPI(Dataset.copy_column_from_datasets)
  );
  app.post(
    '/dc_tools/dataset_column_batch_update',
    auth,
    catchAPI(Dataset.datasetColumnBatchUpdate)
  );
  app.delete('/dc_tools/hide_datasets', auth, catchAPI(Dataset.hide_datasets));
};
