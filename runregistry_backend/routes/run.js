const Run = require('../controllers/run');
const auth = require('../auth/authenticate');
const { catchAPIError: catchAPI } = require('../utils/error_handlers');

module.exports = app => {
  app.get('/runs/:run_number', catchAPI(Run.getOne));
  app.get('/runs/', catchAPI(Run.get));
  app.get('/runs_lastupdated_50', catchAPI(Run.getLastUpdated50));
  app.get('/run_with_history/:run_number', catchAPI(Run.getRunWithHistory));
  app.post('/runs/', catchAPI(Run.new));
  app.get(
    '/get_all_dataset_names_of_run/:run_number',
    catchAPI(Run.getDatasetNamesOfRun)
  );
  app.put(
    '/automatic_run_update/:run_number',
    auth,
    catchAPI(Run.automatic_run_update)
  );
  app.put('/manual_run_edit/:run_number', auth, catchAPI(Run.manual_edit));

  // Querying:
  app.post('/runs_filtered_ordered', catchAPI(Run.getRunsFilteredOrdered));

  // Shifter actions:
  app.post('/runs/mark_significant', auth, catchAPI(Run.markSignificant));
  app.post('/runs/move_run/:from_state/:to_state', auth, catchAPI(Run.moveRun));
  app.post(
    '/runs/refresh_run/:run_number',
    catchAPI(Run.refreshRunClassAndComponents)
  );
};
