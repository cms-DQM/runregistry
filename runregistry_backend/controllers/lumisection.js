const sequelize = require('../models').sequelize;
const Sequelize = require('../models').Sequelize;
const {
  Run,
  Dataset,
  Event,
  LumisectionEvent,
  LumisectionEventAssignation,
  OMSLumisectionEvent,
  OMSLumisectionEventAssignation,
  AggregatedLumisection,
} = require('../models');
const {
  convert_array_of_ranges_to_array_of_list,
} = require('golden-json-helpers');
const { deepEqual } = require('assert');
const {
  oms_lumisection_whitelist,
  oms_lumisection_luminosity_whitelist,
} = require('../config/config');

const getAttributesSpecifiedFromArray = require('get-attributes-specified-from-array');
const getObjectWithAttributesThatChanged = require('get-object-with-attributes-that-changed');
const { findOrCreateJSONB } = require('./JSONBDeduplication');
const { fill_dataset_triplet_cache } = require('./dataset_triplet_cache');
const { create_new_version } = require('./version');

// Its a range, contains start_lumisection AND it contains end_lumisection
const update_or_create_lumisection = async ({
  run_number,
  dataset_name,
  lumisection_metadata,
  start_lumisection,
  end_lumisection,
  req,
  LSEvent,
  LSEventAssignation,
  atomic_version,
  transaction,
}) => {
  const by = req.email || req.get('email');
  if (!by) {
    throw "The email of the author's action should be stated in request's header 'email'";
  }
  if (start_lumisection > end_lumisection) {
    throw 'Start Lumisection must be less than end lumisection';
  }
  // Start transaction:
  let local_transaction = false;
  try {
    if (typeof transaction === 'undefined') {
      local_transaction = true;
      transaction = await sequelize.transaction();
    }
    const event = await Event.create(
      {
        atomic_version,
      },
      { transaction }
    );
    const deduplicated_jsonb = await findOrCreateJSONB(lumisection_metadata);

    let manual_change = false;
    if (!by.startsWith('auto@auto')) {
      manual_change = true;
    }
    const lumisectionEvent = await LSEvent.create(
      {
        run_number,
        name: dataset_name,
        lumisection_metadata_id: deduplicated_jsonb.id,
        version: event.version,
        manual_change,
      },
      { transaction }
    );
    const lumisection_entries = [];
    for (let i = start_lumisection; i <= end_lumisection; i++) {
      lumisection_entries.push({
        version: event.version,
        lumisection_number: i,
      });
    }
    await LSEventAssignation.bulkCreate(lumisection_entries, {
      transaction,
    });
    if (local_transaction) {
      await transaction.commit();
    }
    return lumisectionEvent;
  } catch (err) {
    console.log(err);
    if (local_transaction) {
      await transaction.rollback();
    }
    throw `Error updating/saving dataset ${dataset_name} of run ${run_number} lumisections`;
  }
};

exports.create_oms_lumisections = async ({
  run_number,
  dataset_name,
  lumisections,
  req,
  atomic_version,
  transaction,
}) => {
  const whitelist_including_luminosity = [
    ...oms_lumisection_whitelist,
    ...oms_lumisection_luminosity_whitelist,
  ];
  const lumisection_ranges = await exports.getLumisectionRanges(
    lumisections,
    whitelist_including_luminosity
  );

  const saved_ranges = lumisection_ranges.map(async (lumisection_range) => {
    const { start, end } = lumisection_range;
    const lumisection_range_values = { ...lumisection_range };
    delete lumisection_range_values.start;
    delete lumisection_range_values.end;
    return await update_or_create_lumisection({
      run_number,
      dataset_name,
      lumisection_metadata: lumisection_range_values,
      start_lumisection: start,
      end_lumisection: end,
      req,
      LSEvent: OMSLumisectionEvent,
      LSEventAssignation: OMSLumisectionEventAssignation,
      atomic_version,
      transaction,
    });
  });
  await Promise.all(saved_ranges);
  return saved_ranges;
};

// Receives a whole LUMISECTION ARRAY not a range
exports.create_rr_lumisections = async ({
  run_number,
  dataset_name,
  lumisections,
  req,
  atomic_version,
  transaction,
}) => {
  // let local_whitelist;
  // if (dataset_name !== 'online') {
  //     // If we are not dealing with online, we do not want to whitelist
  //     local_whitelist = ['*'];
  // }

  const lumisection_ranges = await exports.getLumisectionRanges(lumisections, [
    '*',
  ]);

  const saved_ranges = lumisection_ranges.map(async (lumisection_range) => {
    const { start, end } = lumisection_range;
    const lumisection_range_values = { ...lumisection_range };
    delete lumisection_range_values.start;
    delete lumisection_range_values.end;
    return await update_or_create_lumisection({
      run_number,
      dataset_name,
      lumisection_metadata: lumisection_range_values,
      start_lumisection: start,
      end_lumisection: end,
      req,
      LSEvent: LumisectionEvent,
      LSEventAssignation: LumisectionEventAssignation,
      transaction,
      atomic_version,
    });
  });
  await Promise.all(saved_ranges);
  return saved_ranges;
};

// Receives a whole LUMISECTION ARRAY not a range
exports.update_rr_lumisections = async ({
  run_number,
  dataset_name,
  new_lumisections,
  req,
  atomic_version,
  transaction,
}) => {
  const by = req.email || req.get('email');

  let get_lumisections_without_shifter_intervention = false;
  if (by === 'auto@auto') {
    // If it is an automatic change, we want the program to get the lumisections without any change, so that if a change,after the shifters action occurs, it only saves it once:
    get_lumisections_without_shifter_intervention = true;
  }

  const previous_lumisections = await exports.get_rr_lumisections_for_dataset(
    run_number,
    dataset_name,
    get_lumisections_without_shifter_intervention
  );
  let local_whitelist = ['*'];

  const new_ls_ranges = exports.getNewLumisectionRanges(
    previous_lumisections,
    new_lumisections,
    local_whitelist
  );
  const saved_ranges = new_ls_ranges.map(async (lumisection_range) => {
    const { start, end } = lumisection_range;
    const lumisection_range_values = { ...lumisection_range };
    delete lumisection_range_values.start;
    delete lumisection_range_values.end;
    return await update_or_create_lumisection({
      run_number,
      dataset_name,
      lumisection_metadata: lumisection_range_values,
      start_lumisection: start,
      end_lumisection: end,
      req,
      LSEvent: LumisectionEvent,
      LSEventAssignation: LumisectionEventAssignation,
      atomic_version,
      transaction,
    });
  });
  await Promise.all(saved_ranges);
  return saved_ranges;
};

exports.update_oms_lumisections = async ({
  run_number,
  dataset_name,
  new_lumisections,
  req,
  atomic_version,
  transaction,
}) => {
  const previous_lumisections = await exports.get_oms_lumisections_for_dataset(
    run_number,
    dataset_name
  );

  const whitelist_including_luminosity = [
    ...oms_lumisection_whitelist,
    ...oms_lumisection_luminosity_whitelist,
  ];
  const new_ls_ranges = exports.getNewLumisectionRanges(
    previous_lumisections,
    new_lumisections,
    whitelist_including_luminosity
  );
  const saved_ranges = new_ls_ranges.map(async (lumisection_range) => {
    const { start, end } = lumisection_range;
    const lumisection_range_values = { ...lumisection_range };
    delete lumisection_range_values.start;
    delete lumisection_range_values.end;
    return await update_or_create_lumisection({
      run_number,
      dataset_name,
      lumisection_metadata: lumisection_range_values,
      start_lumisection: start,
      end_lumisection: end,
      req,
      LSEvent: OMSLumisectionEvent,
      LSEventAssignation: OMSLumisectionEventAssignation,
      transaction,
      atomic_version,
    });
  });
  await Promise.all(saved_ranges);
  return saved_ranges;
};

// This method is used when someone/cron automatically updates the values of the lumisections. We try to preserve the lumisection ranges which still apply, and calculate the minimum amount of new LS ranges necessary to fulfill the change
// Returns the newLSRanges if there were any
exports.getNewLumisectionRanges = (
  previous_lumisections,
  new_lumisections,
  lumisection_whitelist
) => {
  // Check if the lumisections are equal, if they are equal, do nothing.
  // If the lumisections are different, then create the ranges for the ones which changed

  if (previous_lumisections.length > new_lumisections.length) {
    throw 'Lumisections cannot be deleted';
  }
  const new_ls_ranges = [];

  for (let i = 0; i < new_lumisections.length; i++) {
    let current_previous_lumisection = previous_lumisections[i] || {};
    let current_new_lumisection = new_lumisections[i];
    if (lumisection_whitelist[0] !== '*') {
      current_previous_lumisection = getAttributesSpecifiedFromArray(
        current_previous_lumisection,
        lumisection_whitelist
      );
      current_new_lumisection = getAttributesSpecifiedFromArray(
        current_new_lumisection,
        lumisection_whitelist
      );
    }

    // We will check if the lumisections are equal one by one
    try {
      deepEqual(current_previous_lumisection, current_new_lumisection);
      if (new_ls_ranges.length > 0) {
        // If we had something saved in the range, we close it, since we found that there was one lumisection in the way which did match (and did not throw exception)
        const previous_range = new_ls_ranges[new_ls_ranges.length - 1];
        // If the range has not been closed yet:
        if (typeof previous_range.end === 'undefined') {
          new_ls_ranges[new_ls_ranges.length - 1] = {
            ...previous_range,
            end: i,
          };
        }
      }
    } catch (e) {
      // this means that they are not equal

      // Lumisection changed, therefore we need to create a new range
      if (new_ls_ranges.length === 0) {
        const new_lumisection_attributes = getObjectWithAttributesThatChanged(
          current_previous_lumisection,
          current_new_lumisection
        );
        // If there is something that changed, we create a new range:
        if (Object.keys(new_lumisection_attributes).length > 0) {
          new_ls_ranges.push({
            ...new_lumisection_attributes,
            start: i + 1,
          });
        }
      } else {
        const previous_range = new_ls_ranges[new_ls_ranges.length - 1];
        const previous_range_copy = { ...previous_range };
        const potentially_new_lumisection_attributes = getObjectWithAttributesThatChanged(
          current_previous_lumisection,
          current_new_lumisection
        );
        // We delete start and end from previous range so that it doesn't interfere with deepEqual
        delete previous_range_copy.start;
        delete previous_range_copy.end;
        try {
          deepEqual(
            previous_range_copy,
            potentially_new_lumisection_attributes
          );
        } catch (e) {
          if (typeof previous_range.end === 'undefined') {
            new_ls_ranges[new_ls_ranges.length - 1] = {
              ...previous_range,
              end: i,
            };
          }
          const new_lumisection_attributes = getObjectWithAttributesThatChanged(
            current_previous_lumisection,
            current_new_lumisection
          );
          new_ls_ranges.push({
            ...new_lumisection_attributes,
            start: i + 1,
          });
        }
      }
    }
  }
  if (new_ls_ranges.length > 0) {
    // If we had something saved in the range, we close it, since we found that there was one lumisection in the way which did match (and did not throw exception)
    const previous_range = new_ls_ranges[new_ls_ranges.length - 1];
    // If the range has not been closed yet:
    if (typeof previous_range.end === 'undefined') {
      new_ls_ranges[new_ls_ranges.length - 1] = {
        ...previous_range,
        end: new_lumisections.length,
      };
    }
  }
  return new_ls_ranges;
};

// get ranges per component in the form of:
// cms_range: [{from:x, to: y, ...}, {}]
// dt_range: [{},{}]
exports.get_rr_lumisection_ranges_for_dataset = async (
  run_number,
  dataset_name
) => {
  const merged_lumisections = await sequelize.query(
    `
        SELECT run_number, "name", lumisection_number, mergejsonb(lumisection_metadata ORDER BY manual_change, version) as "triplets"
        FROM(
        SELECT "LumisectionEvent"."version", run_number, "name", jsonb AS "lumisection_metadata", lumisection_number, manual_change  FROM "LumisectionEvent" INNER JOIN "LumisectionEventAssignation" 
        ON "LumisectionEvent"."version" = "LumisectionEventAssignation"."version" INNER JOIN "JSONBDeduplication" ON "lumisection_metadata_id" = "id"
        WHERE "LumisectionEvent"."name" = :dataset_name AND "LumisectionEvent"."run_number" = :run_number
        ) AS "updated_lumisectionEvents"
        GROUP BY "run_number", "name", lumisection_number 
        ORDER BY lumisection_number;
    `,
    {
      type: sequelize.QueryTypes.SELECT,
      replacements: {
        run_number,
        dataset_name,
      },
    }
  );

  // Put all the components present in the dataset
  const components_present_in_dataset = [];
  merged_lumisections.forEach(({ triplets }) => {
    for (const [component, val] of Object.entries(triplets)) {
      if (!components_present_in_dataset.includes(component)) {
        components_present_in_dataset.push(component);
      }
    }
  });

  const ranges = {};
  components_present_in_dataset.forEach((component) => {
    const component_merged_lumisections = merged_lumisections.map(
      (lumisection) => {
        return lumisection.triplets[component];
      }
    );
    ranges[
      component
    ] = exports.getLumisectionRanges(component_merged_lumisections, ['*']);
  });
  return ranges;
};

// Get all component lumisections (not a range):
// Without manual changes (if set to true) gives us the AUTOMATIC changes without the priority of shifters intervention:
// So if there is an automatic change after manual change, it will not be reflected UNLESS we do without_manual_change as true
exports.get_rr_lumisections_for_dataset = async (
  run_number,
  dataset_name,
  without_manual_changes = false
) => {
  const merged_lumisections = await sequelize.query(
    `
        SELECT run_number, "name", lumisection_number, mergejsonb(lumisection_metadata ORDER BY ${
          without_manual_changes ? '' : 'manual_change,'
        } version ) as "triplets"
        FROM(
        SELECT "LumisectionEvent"."version", run_number, "name", jsonb AS "lumisection_metadata", lumisection_number, manual_change  FROM "LumisectionEvent" INNER JOIN "LumisectionEventAssignation" 
        ON "LumisectionEvent"."version" = "LumisectionEventAssignation"."version" INNER JOIN "JSONBDeduplication" ON "lumisection_metadata_id" = "id"
        WHERE "LumisectionEvent"."name" = :dataset_name AND "LumisectionEvent"."run_number" = :run_number
        ) AS "updated_lumisectionEvents"
        GROUP BY "run_number", "name", lumisection_number 
        ORDER BY lumisection_number;
    `,
    {
      type: sequelize.QueryTypes.SELECT,
      replacements: {
        run_number,
        dataset_name,
      },
    }
  );
  // Put all the components present in the dataset
  const components_present_in_dataset = [];
  merged_lumisections.forEach(({ triplets }) => {
    for (const [component, val] of Object.entries(triplets)) {
      if (!components_present_in_dataset.includes(component)) {
        components_present_in_dataset.push(component);
      }
    }
  });

  const lumisections_with_empty_wholes = [];
  // Insert data:
  if (merged_lumisections.length > 0) {
    const last_lumisection_number =
      merged_lumisections[merged_lumisections.length - 1].lumisection_number;
    let current_merged_lumisection_element = 0;
    for (let i = 0; i < last_lumisection_number; i++) {
      const { triplets, lumisection_number } = merged_lumisections[
        current_merged_lumisection_element
      ];
      lumisections_with_empty_wholes[i] = {};
      if (i + 1 === lumisection_number) {
        current_merged_lumisection_element += 1;
        components_present_in_dataset.forEach((component) => {
          if (typeof triplets[component] === 'object') {
            lumisections_with_empty_wholes[i][component] = triplets[component];
          } else {
            // If the triplet for this particular change is not in there, it was empty, so we add an empty triplet
            lumisections_with_empty_wholes[i][component] = {
              status: 'EMPTY',
              comment: '',
              cause: '',
            };
          }
        });
      } else {
        // it is just a space between lumisections. where there are some lumisections above and some below, it just means its an empty lumisection
        components_present_in_dataset.forEach((component) => {
          lumisections_with_empty_wholes[i][component] = {
            status: 'EMPTY',
            comment: '',
            cause: '',
          };
        });
      }
    }
  }
  return lumisections_with_empty_wholes;
};

// OMS lumisections can be either the online dataset (default) or it can inherit from the online dataset and then have changes on it:
exports.get_oms_lumisections_for_dataset = async (
  run_number,
  dataset_name = 'online'
) => {
  // OMS lumisections can be either the online dataset (default) or it can inherit from the online dataset and then have changes on it:
  const not_online_dataset =
    dataset_name === 'online'
      ? ''
      : ` OR "OMSLumisectionEvent"."name" = :dataset_name`;
  const merged_lumisections = await sequelize.query(
    `
        SELECT run_number, lumisection_number, mergejsonb(lumisection_metadata ORDER BY version ) as "oms_json_blob"
        FROM(
        SELECT "OMSLumisectionEvent"."version", run_number, "name", jsonb AS "lumisection_metadata", lumisection_number  FROM "OMSLumisectionEvent" INNER JOIN "OMSLumisectionEventAssignation" 
        ON "OMSLumisectionEvent"."version" = "OMSLumisectionEventAssignation"."version" INNER JOIN "JSONBDeduplication" ON "lumisection_metadata_id" = "id"
        WHERE ("OMSLumisectionEvent"."name" = 'online' ${not_online_dataset}) AND "OMSLumisectionEvent"."run_number" = :run_number
        ) AS "updated_lumisectionEvents"
        GROUP BY "run_number", lumisection_number 
        ORDER BY lumisection_number;
    `,
    {
      type: sequelize.QueryTypes.SELECT,
      replacements: {
        run_number,
        dataset_name,
      },
    }
  );

  const lumisections_with_empty_wholes = [];
  // Insert data:
  if (merged_lumisections.length > 0) {
    const last_lumisection_number =
      merged_lumisections[merged_lumisections.length - 1].lumisection_number;
    let current_merged_lumisection_element = 0;
    for (let i = 0; i < last_lumisection_number; i++) {
      const { oms_json_blob, lumisection_number } = merged_lumisections[
        current_merged_lumisection_element
      ];
      lumisections_with_empty_wholes[i] = {};
      if (i + 1 === lumisection_number) {
        current_merged_lumisection_element += 1;
        lumisections_with_empty_wholes[i] = oms_json_blob;
      } else {
        // it is just a space between lumisections. where there are some lumisections above and some below, it just means its an empty lumisection
        lumisections_with_empty_wholes[i] = {
          err: 'No data available for this lumisection',
        };
      }
    }
  }
  return lumisections_with_empty_wholes;
};

// Returns LS ranges in format: [{start:0, end: 23, ...values}, {start: 24, end: 90, ...values}]
exports.getLumisectionRanges = (lumisections, lumisection_attributes) => {
  // We whitelist the attributes we want (if it is an * in an array, it means we want all):
  if (lumisection_attributes[0] !== '*') {
    lumisections = lumisections.map((lumisection) =>
      getAttributesSpecifiedFromArray(lumisection, lumisection_attributes)
    );
  }

  const ls_ranges = [];
  if (lumisections.length > 0) {
    ls_ranges.push({ ...lumisections[0], start: 1 });

    for (let i = 1; i < lumisections.length; i++) {
      const previous_range = { ...ls_ranges[ls_ranges.length - 1] };
      const previous_range_copy = { ...previous_range };
      // We delete start and end from previous range so that it doesn't interfere with deepEqual
      delete previous_range_copy.start;
      delete previous_range_copy.end;
      const current_range = lumisections[i];

      try {
        deepEqual(previous_range_copy, current_range);
      } catch (e) {
        // This means that there is a LS break in the range (exception thrown), not equal, therefore we create a break in the ranges array:
        ls_ranges[ls_ranges.length - 1] = {
          ...previous_range,
          end: i,
        };
        ls_ranges.push({ ...lumisections[i], start: i + 1 });
      }
    }

    // Set the end of final range:
    ls_ranges[ls_ranges.length - 1] = {
      ...ls_ranges[ls_ranges.length - 1],
      end: lumisections.length,
    };
  }

  return ls_ranges;
};

exports.edit_rr_lumisections = async (req, res) => {
  const {
    run_number,
    dataset_name,
    component,
    new_lumisection_range,
  } = req.body;
  let { start, end, status, comment, cause } = new_lumisection_range;
  if (!status) {
    throw 'No status present when trying to edit lumisections';
  }
  if (status === 'BAD' && (!comment || comment.length < 3)) {
    throw 'When setting lumisections as BAD, there MUST be a comment for this action.';
  }
  const lumisection_metadata = {
    [component]: {
      // For consistency we want triplet values to be either their value or empty strings:
      status: status || '',
      comment: comment || '',
      cause: cause || '',
    },
  };
  if (dataset_name === 'online') {
    const run = await Run.findByPk(run_number);
    if (run.rr_attributes.state !== 'OPEN') {
      throw 'Run must be in state OPEN to be edited';
    }
  } else {
    // TODO: validate the dataset state is OPEN in this workspace (fom backend)
    const dataset = Dataset.findOne({
      where: {
        name: dataset_name,
        run_number,
      },
    });
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { atomic_version } = await create_new_version({
      req,
      transaction,
      comment: 'edit lumisections of a dataset',
    });
    const new_range = await update_or_create_lumisection({
      run_number,
      dataset_name,
      lumisection_metadata,
      start_lumisection: start,
      end_lumisection: end,
      req,
      LSEvent: LumisectionEvent,
      LSEventAssignation: LumisectionEventAssignation,
      atomic_version,
      transaction,
    });
    // Bump the version in the dataset so the fill_dataset_triplet_cache will know that the lumisections inside it changed, and so can refill the cache:
    const { update_or_create_dataset } = require('./dataset');
    const datasetEvent = await update_or_create_dataset({
      dataset_name,
      run_number,
      dataset_metadata: {},
      atomic_version,
      transaction,
    });
    await transaction.commit();
    await fill_dataset_triplet_cache();
    res.json(new_range);
  } catch (err) {
    console.log(err);
    await transaction.rollback();
    throw `Error updating lumisections of ${dataset_name} dataset, run number: ${run_number}: ${
      err.message || err
    }`;
  }
};

exports.edit_oms_lumisections = async (req, res) => {
  const {
    run_number,
    dataset_name,
    component: dcs_bit,
    new_lumisection_range,
  } = req.body;
  let { start, end, status, comment } = new_lumisection_range;
  if (status === 'true') {
    status = true;
  }
  if (status === 'false') {
    status = false;
  }
  if (status !== true && status !== false) {
    throw 'DCS Bits can only be true or false';
  }
  if (!status) {
    throw 'No status present when trying to edit lumisections';
  }
  if (!comment || comment.length < 3) {
    throw 'No comment present when editing OMS lumisections, comment MUST be present when editing OMS lumisections';
  }

  const lumisection_metadata = {
    [dcs_bit]: status,
  };
  if (dataset_name === 'online') {
    const run = await Run.findByPk(run_number);
    if (run.rr_attributes.state !== 'OPEN') {
      throw 'Run must be in state OPEN to be edited';
    }
  } else {
    // TODO: validate the dataset state is OPEN in this workspace (fom backend)
    const dataset = Dataset.findOne({
      where: {
        name: dataset_name,
        run_number,
      },
    });
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { atomic_version } = await create_new_version({
      req,
      transaction,
      comment: `Edit OMS lumisection ranges, user comment: '${comment}'`,
    });
    const new_range = await update_or_create_lumisection({
      run_number,
      dataset_name,
      lumisection_metadata,
      start_lumisection: start,
      end_lumisection: end,
      req,
      LSEvent: OMSLumisectionEvent,
      LSEventAssignation: OMSLumisectionEventAssignation,
      atomic_version,
      transaction,
    });
    // Bump the version in the dataset so the fill_dataset_triplet_cache will know that the lumisections inside it changed, and so can refill the cache:
    const { update_or_create_dataset } = require('./dataset');
    const datasetEvent = await update_or_create_dataset({
      dataset_name,
      run_number,
      dataset_metadata: {},
      atomic_version,
      transaction,
    });
    await transaction.commit();
    await fill_dataset_triplet_cache();
    res.json(new_range);
  } catch (err) {
    console.log(err);
    await transaction.rollback();
    throw `Error updating oms lumisections of ${dataset_name} dataset, run number: ${run_number}: ${
      err.message || err
    }`;
  }
};
exports.get_rr_and_oms_lumisection_ranges = async (req, res) => {
  const { run_number, dataset_name } = req.body;
  const rr_lumisections = await exports.get_rr_lumisections_for_dataset(
    run_number,
    dataset_name,
    false
  );
  const oms_lumisections = await exports.get_oms_lumisections_for_dataset(
    run_number,
    'online'
  );
  let joint_lumisections;
  if (rr_lumisections.length >= oms_lumisections.length) {
    joint_lumisections = rr_lumisections.map((rr_lumisection, index) => {
      return { ...oms_lumisections[index], ...rr_lumisection };
    });
  } else {
    joint_lumisections = oms_lumisections.map((oms_lumisection, index) => {
      return { ...oms_lumisection, ...rr_lumisections[index] };
    });
  }
  // TODO: FIX THE WHITELIST FOR JOINT LUMISECTIONS (TO REMOVE LUMINOSITY SO THEY COLLAPSE INTO PROPER RANGES)
  const ls_ranges = exports.getLumisectionRanges(joint_lumisections, ['*']);
  res.json(ls_ranges);
};

exports.get_rr_lumisection_ranges_by_component = async (req, res) => {
  const { run_number, dataset_name } = req.body;
  const rr_lumisection_ranges_by_component = await exports.get_rr_lumisection_ranges_for_dataset(
    run_number,
    dataset_name
  );
  res.json(rr_lumisection_ranges_by_component);
};

exports.get_rr_lumisection_ranges = async (req, res) => {
  const { run_number, dataset_name } = req.body;
  const rr_lumisections = await exports.get_rr_lumisections_for_dataset(
    run_number,
    dataset_name,
    false
  );
  const ls_ranges = exports.getLumisectionRanges(rr_lumisections, ['*']);
  res.json(ls_ranges);
};

// get ranges per dcs_bit in the form of:
// dt_ready: [{from:x, to: y, value: false}, {}]
// cms_active: [{},{}]
exports.get_oms_lumisection_ranges_by_dcs_bit = async (req, res) => {
  const { run_number, dataset_name } = req.body;
  const oms_lumisections = await exports.get_oms_lumisections_for_dataset(
    run_number,
    dataset_name || 'online'
  );

  // Put all the dcs bits in the dataset
  const dcs_bits_present = [];
  oms_lumisections.forEach((lumisection) => {
    for (const [dcs_bit, val] of Object.entries(lumisection)) {
      if (!dcs_bits_present.includes(dcs_bit)) {
        dcs_bits_present.push(dcs_bit);
      }
    }
  });

  const ranges = {};
  dcs_bits_present.forEach((dcs_bit) => {
    const dcs_bit_lumisections = oms_lumisections.map((lumisection) => {
      return { status: lumisection[dcs_bit] };
    });
    ranges[dcs_bit] = exports.getLumisectionRanges(dcs_bit_lumisections, ['*']);
  });

  res.json(ranges);
};

exports.get_oms_lumisection_ranges = async (req, res) => {
  const { run_number, dataset_name } = req.body;
  const oms_lumisections = await exports.get_oms_lumisections_for_dataset(
    run_number,
    dataset_name || 'online'
  );
  const ls_ranges = exports.getLumisectionRanges(
    oms_lumisections,
    oms_lumisection_whitelist
  );
  res.json(ls_ranges);
};

exports.get_rr_lumisections = async (req, res) => {
  const { run_number, dataset_name } = req.body;
  const rr_lumisections = await exports.get_rr_lumisections_for_dataset(
    run_number,
    dataset_name
  );
  res.json(rr_lumisections);
};

exports.get_oms_lumisections = async (req, res) => {
  const { run_number, dataset_name } = req.body;
  const oms_lumisections = await exports.get_oms_lumisections_for_dataset(
    run_number,
    dataset_name || 'online'
  );
  res.json(oms_lumisections);
};

exports.get_rr_lumisection_history = async (req, res) => {
  const { run_number, dataset_name } = req.body;
  const history = await sequelize.query(
    `SELECT
            lumisection_events.version,
            lumisection_events.manual_change,
            lumisection_events.run_number,
            lumisection_events.name,
            lumisection_events.start,
            lumisection_events.end,
            "Version".by,
            "Version".comment,
            "Version"."createdAt",
            "JSONBDeduplication".jsonb
        FROM (
            SELECT
                "LumisectionEvent".version,
                run_number,
                "name",
                "LumisectionEvent".lumisection_metadata_id,
                "LumisectionEvent".manual_change,
                min("LumisectionEventAssignation".lumisection_number) as start,
                max("LumisectionEventAssignation".lumisection_number) as end
            FROM "LumisectionEvent"
            INNER JOIN "JSONBDeduplication" on "LumisectionEvent".lumisection_metadata_id = "JSONBDeduplication".id
            INNER JOIN "Event" on "Event".version = "LumisectionEvent".version
            INNER JOIN "LumisectionEventAssignation" on "LumisectionEvent".version = "LumisectionEventAssignation".version
            WHERE run_number=:run_number and name=:name
            GROUP BY run_number, name, "LumisectionEvent".version
            ORDER BY "LumisectionEvent".manual_change ASC, "LumisectionEvent".version ASC
        ) lumisection_events
        INNER JOIN "Event"
        on lumisection_events.version = "Event".version

        INNER JOIN "Version"
        on "Event".atomic_version = "Version".atomic_version

        INNER JOIN "JSONBDeduplication"
        on lumisection_events."lumisection_metadata_id" = "JSONBDeduplication".id
        `,
    {
      type: sequelize.QueryTypes.SELECT,
      replacements: { run_number, name: dataset_name },
    }
  );
  res.json(history);
};

exports.get_oms_lumisection_history = async (req, res) => {
  const { run_number, dataset_name } = req.body;
  const history = await sequelize.query(
    `SELECT
            lumisection_events.version,
            lumisection_events.run_number,
            lumisection_events.name,
            lumisection_events.start,
            lumisection_events.end,
            "Version".by,
            "Version".comment,
            "Version"."createdAt",
            "JSONBDeduplication".jsonb
        FROM (
            SELECT
                "OMSLumisectionEvent".version,
                run_number,
                "name",
                "OMSLumisectionEvent".lumisection_metadata_id,
                min("OMSLumisectionEventAssignation".lumisection_number) as start,
                max("OMSLumisectionEventAssignation".lumisection_number) as end
            FROM "OMSLumisectionEvent"
            INNER JOIN "JSONBDeduplication" on "OMSLumisectionEvent".lumisection_metadata_id = "JSONBDeduplication".id
            INNER JOIN "Event" on "Event".version = "OMSLumisectionEvent".version
            INNER JOIN "OMSLumisectionEventAssignation" on "OMSLumisectionEvent".version = "OMSLumisectionEventAssignation".version
            WHERE run_number=:run_number and (name='online' OR name=:name)
            GROUP BY run_number, name, "OMSLumisectionEvent".version
            ORDER BY "OMSLumisectionEvent".version
        ) lumisection_events
        INNER JOIN "Event"
        on lumisection_events.version = "Event".version

        INNER JOIN "Version"
        on "Event".atomic_version = "Version".atomic_version

        INNER JOIN "JSONBDeduplication"
        on lumisection_events."lumisection_metadata_id" = "JSONBDeduplication".id
        `,
    {
      type: sequelize.QueryTypes.SELECT,
      replacements: { run_number, name: dataset_name },
    }
  );
  res.json(history);
};

// used for visualization of lumisections that didnt make it to the golden json:
exports.get_data_of_json = async (req, res) => {
  const { json } = req.body;
  const json_with_data = {};
  let total_recorded_luminosity = 0;
  let total_delivered_luminosity = 0;
  for (const [dataset_identifier, ranges] of Object.entries(json)) {
    if (!dataset_identifier.includes('-')) {
      throw "Every entry in the json must include the respective dataset name, as in '316701-/PromptReco/Collisions2018A/DQM";
    }
    const [run_number, dataset_name] = dataset_identifier.split(/-(.+)/); // We split the run_number and dataset name, we use the regular expression to split on the first occurrence of character '-'
    const lumisection_numbers = convert_array_of_ranges_to_array_of_list(
      ranges
    );
    const lumisections = await AggregatedLumisection.findAll({
      where: {
        run_number,
        name: dataset_name,
        lumisection_number: { [Sequelize.Op.in]: lumisection_numbers },
      },
    });

    lumisections.forEach((lumisection, index) => {
      const { lumisection_number, oms_lumisection } = lumisection;
      if (lumisection_numbers.includes(lumisection_number)) {
        // We want non-negative luminosity numbers:
        const recorded = +oms_lumisection.recorded || 0;
        const delivered = +oms_lumisection.delivered || 0;
        const recorded_non_negative = recorded >= 0 ? recorded : 0;
        const delivered_non_negative = delivered >= 0 ? delivered : 0;
        total_recorded_luminosity += recorded_non_negative;
        total_delivered_luminosity += delivered_non_negative;
        const formatted_lumisection = exports.format_lumisection(lumisection);
        if (typeof json_with_data[dataset_identifier] === 'undefined') {
          json_with_data[dataset_identifier] = {
            [lumisection_number]: formatted_lumisection,
          };
        } else {
          json_with_data[dataset_identifier][
            lumisection_number
          ] = formatted_lumisection;
        }
      }
    });
  }
  res.json({
    json_with_data,
    total_recorded_luminosity,
    total_delivered_luminosity,
  });
};

exports.format_lumisection = (lumisection) => {
  // Ignore comment and cause in triplets, just keep the status:
  const rr_lumisection = {};
  for (const [key, val] of Object.entries(lumisection.rr_lumisection)) {
    rr_lumisection[key] = val.status;
  }
  const formatted_lumisection = {
    dataset: { ...lumisection.dataset_attributes, name: lumisection.name },
    run: {
      oms: lumisection.run_oms_attributes,
      rr: lumisection.run_rr_attributes,
      run_number: lumisection.run_number,
    },
    lumisection: {
      lumisection_number: lumisection.lumisection_number,
      oms: lumisection.oms_lumisection,
      rr: rr_lumisection,
    },
  };
  return formatted_lumisection;
};

exports.get_luminosity_of_json_with_dataset_names = async (req, res) => {
  const { json_with_dataset_names } = req.body;
  const json_with_luminosity = {};
  for (const [key, ls_ranges] of Object.entries(json_with_dataset_names)) {
    json_with_luminosity[key] = 0;
    const [run_number, dataset_name] = key.split('-');
    const lumisection_numbers = convert_array_of_ranges_to_array_of_list(
      ls_ranges
    );
    const lumisections = await AggregatedLumisection.findAll({
      where: {
        run_number,
        name: dataset_name,
        lumisection_number: { [Sequelize.Op.in]: lumisection_numbers },
      },
    });
    lumisections.forEach((lumisection) => {
      const { oms_lumisection, lumisection_number } = lumisection;
      if (lumisection_numbers.includes(lumisection_number)) {
        const recorded = +oms_lumisection.recorded || 0;
        json_with_luminosity[key] += recorded > 0 ? recorded : 0;
      }
    });
  }
  res.json(json_with_luminosity);
};
