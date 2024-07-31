const assert = require('assert').strict;
const appendToAllAttributes = require('append-to-all-attributes');
const {
  getComponentsIncludedBooleans,
  get_beam_present_and_stable,
  assign_run_class,
  is_run_significant,
  assign_lumisection_component_status,
} = require('./saving_updating_runs_lumisections_utils');

// Using the per-LS OMS attributes, we construct new attributes, to be stored
// in the newly created object, "oms_attributes", such as "pixel_included" if "PIXEL" was found in run.components.
// "beams_present_and_stable" is also added to the returned object.
exports.augment_oms_run_attributes = async (run, lumisections) => {
  const components_included_in_run = getComponentsIncludedBooleans(run);
  // Deconstruct all the attributes inside the new object.
  const oms_attributes = {
    ...run,
    ...components_included_in_run,
  };
  // 'beams_present_and_stable' will only be true if there is at least 1 LS with all other true
  oms_attributes.beams_present_and_stable = get_beam_present_and_stable(
    lumisections
  );
  oms_attributes.ls_duration = lumisections.length;
  return oms_attributes;
};

// Given fresh information from OMS for the run and its lumisections,
// re-classify the run and check if it's significant or not.
// If we're given existing RR attributes, we preserve them.
// Return an ojb
exports.calculate_updated_rr_run_attributes = async (
  oms_run_attributes,
  oms_lumisections,
  previous_rr_run_attributes
) => {
  let rr_run_attributes = {};
  // Significant starts being false, class is to be determined later
  rr_run_attributes.significant = false;
  rr_run_attributes.class = '';
  // However, if it is a refresh ('update_runs' from 2.save_or_update_runs), we want to preserve the previous values of the run and only recalculate the class and if the run was significant:
  if (previous_rr_run_attributes) {
    rr_run_attributes = previous_rr_run_attributes;
  }

  // hlt_key is necessary to calculate the run's class, so if its not available skip run classification
  if (oms_run_attributes.hlt_key !== null) {
    rr_run_attributes.class = await assign_run_class(
      oms_run_attributes,
      rr_run_attributes,
      oms_lumisections
    );
  }
  // Class is needed to determine significance of run, so it is calculated before
  // TODO: What happens if hlt_key was null, and there's no class assigned at this point?
  // is_run_significant requires it.
  let run_was_previously_significant = rr_run_attributes.significant;
  rr_run_attributes.significant = await is_run_significant(
    oms_run_attributes,
    rr_run_attributes,
    oms_lumisections
  );

  // Make sure that if for some reason lumisections disappear
  // and the run is no longer significant, we don't mess up the run information.
  // TODO: This is probably not the best place to do this check
  if (run_was_previously_significant) {
    assert.deepStrictEqual(rr_run_attributes.significant && oms_lumisections.length !== 0, true,
      `Run ${oms_run_attributes.run_number} would no longer be deemed significant`)
  }

  return rr_run_attributes;
};

exports.classify_rr_lumisection_components = async (
  oms_attributes,
  rr_attributes,
  oms_lumisections
) => {
  console.info(`Classifying ${oms_lumisections.length} lumisections...`)
  const rr_lumisections = await assign_lumisection_component_status(
    oms_attributes,
    rr_attributes,
    oms_lumisections
  );
  return rr_lumisections;
};
