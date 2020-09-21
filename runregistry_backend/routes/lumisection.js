const { catchAPIError: catchAPI } = require('../utils/error_handlers');
const auth = require('../auth/authenticate');
const Lumisection = require('../controllers/lumisection');

module.exports = (app) => {
  app.post(
    '/lumisections/joint_lumisection_ranges',
    catchAPI(Lumisection.get_rr_and_oms_lumisection_ranges)
  );
  app.post(
    '/lumisections/oms_lumisection_ranges',
    catchAPI(Lumisection.get_oms_lumisection_ranges)
  );
  app.post(
    '/lumisections/rr_lumisection_ranges',
    catchAPI(Lumisection.get_rr_lumisection_ranges)
  );
  // Used in online to edit runs LS components:
  app.post(
    '/lumisections/rr_lumisection_ranges_by_component',
    catchAPI(Lumisection.get_rr_lumisection_ranges_by_component)
  );
  // Used to edit OMS lumisections
  app.post(
    '/lumisections/oms_lumisection_ranges_by_dcs_bit',
    catchAPI(Lumisection.get_oms_lumisection_ranges_by_dcs_bit)
  );
  app.post(
    '/lumisections/rr_lumisections',
    catchAPI(Lumisection.get_rr_lumisections)
  );
  app.post(
    '/lumisections/oms_lumisections',
    catchAPI(Lumisection.get_oms_lumisections)
  );
  app.put(
    '/lumisections/edit_rr_lumisections',
    auth,
    catchAPI(Lumisection.edit_rr_lumisections)
  );
  app.put(
    '/lumisections/edit_oms_lumisections',
    auth,
    catchAPI(Lumisection.edit_oms_lumisections)
  );
  app.post(
    '/lumisections/get_data_of_json',
    catchAPI(Lumisection.get_data_of_json)
  );
  app.post(
    '/lumisections/get_rr_lumisection_history',
    catchAPI(Lumisection.get_rr_lumisection_history)
  );
  app.post(
    '/lumisections/get_oms_lumisection_history',
    catchAPI(Lumisection.get_oms_lumisection_history)
  );
  app.post(
    '/lumisections/get_luminosity_of_json_with_dataset_names',
    catchAPI(Lumisection.get_luminosity_of_json_with_dataset_names)
  );
};
