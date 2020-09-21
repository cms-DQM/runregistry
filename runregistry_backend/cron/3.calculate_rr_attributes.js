const appendToAllAttributes = require('append-to-all-attributes');
const {
  getComponentsIncludedBooleans,
  get_beam_present_and_stable,
  assign_run_class,
  is_run_significant,
  assign_lumisection_component_status
} = require('./saving_updating_runs_lumisections_utils');

exports.calculate_oms_attributes = async (run, lumisections) => {
  const components_included_in_run = getComponentsIncludedBooleans(run);
  const oms_attributes = {
    ...run,
    ...components_included_in_run
  };
  // 'beams_present_and_stable'  will only be true if there is at least 1 LS with all other true
  oms_attributes.beams_present_and_stable = get_beam_present_and_stable(
    lumisections
  );
  oms_attributes.ls_duration = lumisections.length;
  return oms_attributes;
};

exports.calculate_rr_attributes = async (
  oms_attributes,
  oms_lumisections,
  previous_rr_attributes
) => {
  let rr_attributes = {};
  // Significant starts being false, class is to be determined later:
  rr_attributes.significant = false;
  rr_attributes.class = '';
  // However, if it is a refresh ('update_runs' from 2.save_or_update_runs), we want to preserve the previous values of the run and only recalculate the class and if the run was significant:
  if (previous_rr_attributes) {
    rr_attributes = previous_rr_attributes;
  }

  // hlt_key is determinant to calculate the run's class, so if its not ready, we rather wait to classify a run into cosmics, collisions
  if (oms_attributes.hlt_key !== null) {
    rr_attributes.class = await assign_run_class(
      oms_attributes,
      rr_attributes,
      oms_lumisections
    );
  }
  // Class is needed to determine significance of run, so it is calculated before
  rr_attributes.significant = await is_run_significant(
    oms_attributes,
    rr_attributes,
    oms_lumisections
  );

  return rr_attributes;
};

exports.calculate_rr_lumisections = async (
  oms_attributes,
  rr_attributes,
  oms_lumisections
) => {
  const rr_lumisections = await assign_lumisection_component_status(
    oms_attributes,
    rr_attributes,
    oms_lumisections
  );
  return rr_lumisections;
};
