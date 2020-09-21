const { catchAPIError: catchAPI } = require('../utils/error_handlers');
const auth = require('../auth/authenticate');
const Cycle = require('../controllers/cycle');

module.exports = (app) => {
  app.post('/cycles/add_datasets', auth, catchAPI(Cycle.addDatasetsToCycle));
  app.get('/cycles/:workspace', catchAPI(Cycle.getAll));
  app.put(
    '/cycles/mark_cycle_complete/:workspace',
    auth,
    catchAPI(Cycle.markCycleCompletedInWorkspace)
  );
  app.put(
    '/cycles/mark_cycle_pending/:workspace',
    auth,
    catchAPI(Cycle.moveCycleBackToPending)
  );
  app.post('/cycles', auth, catchAPI(Cycle.add));
  app.put('/cycles', auth, catchAPI(Cycle.editCycleInformation));
  app.post(
    '/cycles/add_datasets_to_cycle',
    auth,
    catchAPI(Cycle.addDatasetsToCycle)
  );
  app.post(
    '/cycles/delete_datasets_from_cycle',
    auth,
    catchAPI(Cycle.deleteDatasetsFromCycle)
  );
  // We provide another endpoint for changing state in cycles so that they can move it back to OPEN as long as the cycle is still in open state in such workspace
  app.post(
    '/cycles/move_dataset/:workspace/:from_state/:to_state',
    auth,
    catchAPI(Cycle.moveDataset)
  );
  app.delete('/cycles', auth, catchAPI(Cycle.delete));
  app.post(
    '/cycles/move_all_datasets_to/:workspace',
    auth,
    catchAPI(Cycle.moveAllDatasetsInCycleTo)
  );
};
