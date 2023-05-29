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

  // Endpoint for updating run attributes. Initially a single
  // endpoint, it was later split, in order to give different e-group permissions
  // to modify different run attributes.
  // I.e. only experts should be able to modify the run class,
  // but shifters should be able to modify the stop_reason of the run.
  app.put('/manual_run_edit/:run_number/:attribute', auth, catchAPI(Run.manual_edit));

  // Querying:
  app.post('/runs_filtered_ordered', catchAPI(Run.getRunsFilteredOrdered));

  // Shifter actions:
  app.post('/runs/mark_significant', auth, catchAPI(Run.markSignificant));
  app.post('/runs/move_run/:from_state/:to_state', auth, catchAPI(Run.moveRun));
  app.post('/runs/refresh_run/:run_number', catchAPI(Run.refreshRunClassAndComponents));
  app.post('/runs/reset_and_refresh_run/:run_number', catchAPI(Run.resetAndRefreshRunRRatributes));
};
