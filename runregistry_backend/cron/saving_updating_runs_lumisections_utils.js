const https = require('https');
const axios = require('axios');
const getCookie = require('cern-get-sso-cookie');
const json_logic = require('json-logic-js');
const { handleCronErrors: handleErrors } = require('../utils/error_handlers');
const { API_URL, OMS_URL, OMS_LUMISECTIONS } = require('../config/config')[
  process.env.ENV || 'development'
];

const cert = `${__dirname}/../certs/usercert.pem`;
const key = `${__dirname}/../certs/userkey.pem`;

// Takes the 'components included array' from API and turns it into attributes:
exports.getComponentsIncludedBooleans = oms_attributes => {
  const components = {};
  oms_attributes.components.forEach(component => {
    const component_name = `${component.toLowerCase()}_included`;
    components[component_name] = true;
  });
  return components;
};

exports.get_OMS_lumisections = handleErrors(async run_number => {
  // Get lumisections:
  const oms_lumisection_url = `${OMS_URL}/${OMS_LUMISECTIONS(run_number)}`;
  // Keep fetching until totalresourcecount is # of lumisections
  const oms_lumisection_response = await axios
    .get(oms_lumisection_url, {
      headers: {
        Cookie: await getCookie({
          url: oms_lumisection_url,
          certificate: cert,
          key
        })
      }
    })
    .catch(err => {
      console.log(`Error getting lumisections from OMS for run ${run_number}`);
    });

  if (
    typeof oms_lumisection_response === 'undefined' ||
    typeof oms_lumisection_response.data === 'undefined'
  ) {
    throw `unable to get lumisections for run ${run_number}`;
  }
  let oms_lumisections = oms_lumisection_response.data.data;
  // Deconstruct attributes inside oms_lumisections:
  oms_lumisections = oms_lumisections.map(({ attributes }) => attributes);

  // We add luminosity information
  oms_lumisections = oms_lumisections.map(
    ({ recorded_lumi, delivered_lumi }, index, oms_lumisections) => {
      // If any of them is null, then the per_lumi are all null
      if (recorded_lumi === null || delivered_lumi === null) {
        return {
          ...oms_lumisections[index],
          recorded_lumi_per_lumi: null,
          delivered_lumi_per_lumi: null,
          live_lumi_per_lumi: null
        };
      }
      // we parse them to number:
      recorded_lumi = +recorded_lumi;
      delivered_lumi = +delivered_lumi;
      // recorded_lumi and delivered_lumi are integrated, we have to substract the one in lumisection before to get real value.
      let recorded_lumi_per_lumi;
      let delivered_lumi_per_lumi;
      // If we are at the last lumisection then recorde_lumi_per_lumi and delivered_lumi are 0
      if (index === oms_lumisections.length - 1) {
        recorded_lumi_per_lumi = 0;
        delivered_lumi_per_lumi = 0;
      } else {
        // If we are in any other lumisection then we have to subtract the current value from the next lumisection to get the number of the current LS
        const next_lumisection = oms_lumisections[index + 1];
        recorded_lumi_per_lumi = next_lumisection.recorded_lumi - recorded_lumi;
        delivered_lumi_per_lumi =
          next_lumisection.delivered_lumi - delivered_lumi;
      }
      // live lumi is the fraction of recorded/delivered:
      let live_lumi_per_lumi = null;
      if (delivered_lumi_per_lumi !== 0) {
        live_lumi_per_lumi = recorded_lumi_per_lumi / delivered_lumi_per_lumi;
      }
      return {
        ...oms_lumisections[index],
        recorded_lumi_per_lumi,
        delivered_lumi_per_lumi,
        live_lumi_per_lumi
      };
    }
  );

  return oms_lumisections;
}, 'Error getting lumisection attributes for the run');

exports.get_beam_present_and_stable = lumisections => {
  let beams_present_and_stable = false;
  lumisections.forEach(lumisection => {
    const {
      beam1_present,
      beam1_stable,
      beam2_present,
      beam2_stable
    } = lumisection;
    // If one of them is null, set the conjunction null:
    if (
      beam1_present === null ||
      beam1_stable === null ||
      beam2_present === null ||
      beam2_stable === null
    ) {
      beams_present_and_stable = null;
    } else {
      // Set the conjunction:
      beams_present_and_stable =
        beam1_present && beam1_stable && beam2_present && beam2_stable;
    }
  });
  return beams_present_and_stable;
};

// Reduces the array of lumisections to truthy if only one is true in whole array
exports.reduce_ls_attributes = lumisections => {
  const reduced_values = {};
  // If there is at least 1 LS that is true, then its true for the run:
  lumisections.forEach(lumisection => {
    Object.keys(lumisection).forEach((key, index) => {
      // We are only interested for either true or null values: (if it was true once, it is true for all)
      if (lumisection[key] === true || lumisection[key] === false) {
        reduced_values[key] = lumisection[key];
      }
      // If any value is null, we want it to be false (unsure if null can be true later):
      if (lumisection[key] === null && !reduced_values[key]) {
        reduced_values[key] = false;
      }
    });
  });
  return reduced_values;
};

// If run has a previous class, see if the newly found one has higher priority (lower index of priority means higher priority)
// If run has no previous class, assign class
exports.assign_run_class = handleErrors(
  async (oms_attributes, rr_attributes, oms_lumisections) => {
    const reduced_lumisection_attributes = exports.reduce_ls_attributes(
      oms_lumisections
    );
    const run = {
      ...reduced_lumisection_attributes,
      ...oms_attributes,
      ...rr_attributes
    };
    const { data: classifiers_array } = await axios.get(
      `${API_URL}/classifiers/class`
    );
    classifiers_array.sort((a, b) => a.priority - b.priority);

    // Setup a hash by class name, to later access the priority of a previously assigned class:
    const class_classifiers_indexed_by_class = {};
    classifiers_array.forEach(classifier => {
      class_classifiers_indexed_by_class[classifier.class] = classifier;
    });

    let run_class = '';
    classifiers_array.forEach(classifier => {
      const classifier_json = JSON.parse(classifier.classifier);
      if (json_logic.apply(classifier_json, run)) {
        const assigned_class = classifier.class;
        // A smaller integer in priority is equivalent to MORE priority:
        if (
          run_class === '' ||
          classifier.priority <
            class_classifiers_indexed_by_class[run_class].priority
        ) {
          run_class = assigned_class;
        }
      }
    });
    return run_class;
  },
  'Error assigning run class'
);

exports.is_run_significant = handleErrors(
  async (oms_attributes, rr_attributes, oms_lumisections) => {
    const reduced_lumisection_attributes = exports.reduce_ls_attributes(
      oms_lumisections
    );
    const run = {
      ...reduced_lumisection_attributes,
      ...oms_attributes,
      ...rr_attributes
    };
    let run_is_significant = false;
    const { data: classifiers_array } = await axios.get(
      `${API_URL}/classifiers/dataset`
    );
    classifiers_array.forEach(classifier => {
      const classifier_class = classifier.class;
      classifier = JSON.parse(classifier.classifier);
      if (classifier_class === run.class) {
        const create_dataset = json_logic.apply(classifier, run);
        if (create_dataset) {
          run_is_significant = true;
        }
      }
    });
    return run_is_significant;
  },
  'Error determining if run is significant'
);

// Given the same oms_attributes, rr_attributes, oms_lumisections and classifiers this function will always return the same lumisections with their respective components
exports.assign_lumisection_component_status = handleErrors(
  async (oms_attributes, rr_attributes, oms_lumisections) => {
    const run = { ...oms_attributes, ...rr_attributes };
    // Since we are treating at a lumisection level, we don't need beams_present_and_stable:
    delete run.beams_present_and_stable;
    // We fetch all classifiers and then filter them for each component
    const { data: online_classifiers } = await axios.get(
      `${API_URL}/classifiers/component/online`
    );
    // We group them now by workspace (notice we don't do this via SQL because we still want to preserve history of objects)
    const workspace_classifiers = {};
    online_classifiers.forEach(classifier => {
      const { workspace } = classifier.WorkspaceColumn.Workspace;
      const column_name = classifier.WorkspaceColumn.name;
      workspace_classifiers[workspace] = workspace_classifiers[workspace] || {};
      workspace_classifiers[workspace][column_name] =
        workspace_classifiers[workspace][column_name] || [];
      const columns_of_workspace = workspace_classifiers[workspace];
      const classifiers_of_column = columns_of_workspace[column_name];

      workspace_classifiers[workspace][column_name] = [
        ...classifiers_of_column,
        classifier
      ];
    });
    const rr_lumisections = [];
    oms_lumisections.forEach(oms_lumisection => {
      // We join the attributes from the run AND the lumisection to produce a per lumisection result:
      const run_and_lumisection_attributes = {
        ...run,
        ...oms_lumisection
      };
      const lumisection_components = {};

      // Now per workspace:
      for (const [workspace, columns_of_workspace] of Object.entries(
        workspace_classifiers
      )) {
        // Each workspace has columns:
        for (const [column_name, component_classifiers] of Object.entries(
          columns_of_workspace
        )) {
          const component = `${workspace}-${column_name}`;
          lumisection_components[
            component
          ] = exports.classify_component_per_lumisection(
            run_and_lumisection_attributes,
            component_classifiers,
            component
          );
        }
      }
      rr_lumisections.push(lumisection_components);
    });
    return rr_lumisections;
  },
  'Error assigning component status in dataset'
);

// This method is also used when a dataset is signed off to classify datasets into component classifiers.
exports.classify_component_per_lumisection = (
  run_and_lumisection_attributes,
  component_classifiers
) => {
  // Setup a hash of the classifier of this specific component by status (so that it can be accessed later)
  const component_classifiers_indexed_by_status = {};
  component_classifiers.forEach(classifier => {
    component_classifiers_indexed_by_status[classifier.status] = classifier;
  });

  // We start with the worst possible priority status (NO VALUE FOUND) once it finds a higher priority status, then we change it
  const calculated_triplet = {
    status: 'NO VALUE FOUND',
    comment: '',
    cause: ''
  };

  // And then for each classifier inside the component, we find its priority and check if its superior then the actual one
  component_classifiers.forEach(classifier => {
    if (classifier.enabled) {
      const classifier_json = JSON.parse(classifier.classifier);

      // If it passes the classifier test for this lumisection:
      if (json_logic.apply(classifier_json, run_and_lumisection_attributes)) {
        const assigned_status = classifier.status;
        // We have to compare priorities to the previous one assigned
        const previous_status = calculated_triplet.status;
        // In priority the less, the more priority, priority 1 is more important than priority 2:
        // If the newly calculated status has higher priority than the previous one, then assigned it to the triplet (the classifier by default returns NO VALUE FOUND if it does not pass the test)
        if (
          previous_status === 'NO VALUE FOUND' ||
          component_classifiers_indexed_by_status[assigned_status].priority <
            component_classifiers_indexed_by_status[previous_status].priority
        ) {
          calculated_triplet.status = assigned_status;
          // Add online comment and cause here:
          // calculated_triplet.comment = // criteria for comment
        }
      }
    }
  });
  return calculated_triplet;
};
