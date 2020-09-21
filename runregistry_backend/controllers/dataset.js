const queue = require('async').queue;
const changeNameOfAllKeys = require('change-name-of-all-keys');
const getAttributesSpecifiedFromArray = require('get-attributes-specified-from-array');
const csv_stringify = require('csv-stringify/lib/sync');
const Sequelize = require('../models').Sequelize;
const sequelize = require('../models').sequelize;
const {
  DatasetTripletCache,
  Dataset,
  DatasetEvent,
  Event,
  Workspace,
  Version,
  Run,
} = require('../models');
const {
  get_rr_lumisections_for_dataset,
  get_oms_lumisections_for_dataset,
  get_rr_lumisection_ranges_for_dataset,
  create_rr_lumisections,
  create_oms_lumisections,
  update_oms_lumisections,
} = require('./lumisection');
const { create_new_version } = require('./version');
const {
  fill_dataset_triplet_cache,
  fill_for_unfilled_datasets,
  recalculate_all_triplet_cache,
  processDatasets,
} = require('./dataset_triplet_cache');
const { WAITING_DQM_GUI_CONSTANT } = require('../config/config')[
  process.env.ENV || 'development'
];

const { Op } = Sequelize;
const conversion_operator = {
  and: Op.and,
  or: Op.or,
  '>': Op.gt,
  '<': Op.lt,
  '>=': Op.gte,
  '<=': Op.lte,
  like: Op.iLike,
  notlike: Op.notILike,
  '=': Op.eq,
  '<>': Op.ne,
  // In uppercase as well:
  AND: Op.and,
  OR: Op.or,
  LIKE: Op.iLike,
  NOTLIKE: Op.notLike,
  contains: Op.contains,
};

exports.update_or_create_dataset = async ({
  dataset_name,
  run_number,
  dataset_metadata,
  datasets_in_gui = [],
  atomic_version,
  transaction,
  delete_dataset = false,
}) => {
  run_number = +run_number;
  if (!atomic_version) {
    throw 'A version must be provided';
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

    const datasetEvent = await DatasetEvent.create(
      {
        name: dataset_name,
        run_number,
        dataset_metadata,
        datasets_in_gui,
        version: event.version,
        deleted: delete_dataset,
      },
      { transaction }
    );
    // update the Dataset table
    await sequelize.query(
      `
        CREATE TEMPORARY TABLE updated_dataset_references as SELECT DISTINCT run_number, name from "DatasetEvent" where "DatasetEvent"."version" > (SELECT COALESCE((SELECT MAX("version") from "Dataset"), 0));

        CREATE TEMPORARY TABLE updated_datasets as SELECT "DatasetEvent".* FROM "DatasetEvent" 
        INNER JOIN updated_dataset_references ON "DatasetEvent"."run_number" = updated_dataset_references."run_number" AND "DatasetEvent"."name" = updated_dataset_references."name";

        INSERT INTO "Dataset" (run_number, name, dataset_attributes, datasets_in_gui, deleted, "version")
        SELECT  run_number, 
                name,
                mergejsonb(dataset_metadata ORDER BY version),
                mergejsonbarray(datasets_in_gui ORDER BY version),
                (SELECT deleted from "DatasetEvent" WHERE "version" = (SELECT max(version) FROM updated_datasets AS "deleted")),
                (SELECT max(version) FROM "DatasetEvent" ) AS "version"
        FROM updated_datasets
        GROUP BY (run_number, name)
        ON CONFLICT ("run_number", "name") DO UPDATE SET "run_number"=EXCLUDED."run_number", "name"=EXCLUDED."name", "dataset_attributes" = EXCLUDED."dataset_attributes", "datasets_in_gui" = EXCLUDED."datasets_in_gui",  "deleted" = EXCLUDED."deleted", "version" = EXCLUDED."version";

        DROP TABLE updated_dataset_references;
        DROP TABLE updated_datasets;
        `,
      { transaction }
    );
    if (local_transaction) {
      await transaction.commit();
    }
    return datasetEvent;
  } catch (err) {
    // Rollback transaction if any errors were encountered
    console.log(err);
    if (local_transaction) {
      await transaction.rollback();
    }
    throw `Error updating/saving dataset ${dataset_name} of run: ${run_number}, ${err.message}`;
  }
};

exports.getDatasets = async (req, res) => {
  // const datasets = await Dataset.findAll();
  // res.json(datasets);
};

exports.getDataset = async (req, res) => {
  const { run_number, dataset_name } = req.body;
  const dataset = await Dataset.findOne({
    where: {
      run_number,
      name: dataset_name,
    },
    include: [{ model: Run }, { model: DatasetTripletCache }],
  });
  res.json(dataset);
};

exports.recalculate_cache_for_specific_dataset = async (req, res) => {
  const { run_number, dataset_name } = req.body;
  const dataset = await Dataset.findOne({
    where: {
      run_number,
      name: dataset_name,
    },
  });
  await processDatasets([dataset]);
  await exports.getDataset(req, res);
};

exports.new = async (req, res) => {
  const {
    run_number,
    dataset_name,
    rr_lumisections,
    oms_lumisections,
    dataset_attributes,
  } = req.body;
  const dataset = await Dataset.findOne({
    where: {
      run_number,
      name: dataset_name,
    },
  });
  if (dataset !== null) {
    throw 'Dataset already exists';
  }
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { atomic_version } = await create_new_version({
      req,
      transaction,
      comment: 'dataset creation',
    });

    const datasetEvent = await exports.update_or_create_dataset({
      dataset_name,
      run_number,
      dataset_metadata: dataset_attributes,
      req,
      atomic_version,
      transaction,
    });

    // lumisections
    // For RR lumisections, we create a independent copy of the lumisections (which comes from the request)
    const saved_rr_lumisections = await create_rr_lumisections({
      run_number,
      dataset_name,
      lumisections: rr_lumisections,
      req,
      atomic_version,
      transaction,
    });
    // However for OMS lumisections, if there is new stuff, we simply append it to the current table, so that the aggregate will get the changes
    // It can edit oms_lumisections
    if (oms_lumisections) {
      const previous_oms_lumisections = await get_oms_lumisections_for_dataset(
        run_number,
        dataset_name
      );
      if (oms_lumisections.length !== previous_oms_lumisections.length) {
        throw 'Given lumisections length do not match online lumisections length';
      }
      const newOMSLumisectionRange = await update_oms_lumisections({
        run_number,
        dataset_name,
        new_lumisections: oms_lumisections,
        req,
        atomic_version,
        transaction,
      });
    }
    await transaction.commit();
    await fill_dataset_triplet_cache();
    res.json(datasetEvent);
  } catch (err) {
    console.log(err.message);
    await transaction.rollback();
    throw `Error saving dataset ${dataset_name} of run ${run_number}`;
  }
};

exports.getDatasetsWaiting = async (req, res) => {
  const datasets = await Dataset.findAll({
    where: {
      // DO NOT CHANGE THE FOLLOWING LINE AS APPLICATION LOGIC RELIES ON IT:
      'dataset_attributes.global_state': WAITING_DQM_GUI_CONSTANT,
      deleted: false,
    },
  });
  res.json(datasets);
};
exports.getDatasetsWaitingDBS = async (req, res) => {
  const datasets = await Dataset.findAll({
    where: {
      // DO NOT CHANGE THE FOLLOWING LINE AS APPLICATION LOGIC RELIES ON IT:
      [Op.or]: [
        { 'dataset_attributes.appeared_in': '' },
        { 'dataset_attributes.appeared_in': 'DQM GUI' },
      ],
      deleted: false,
    },
  });
  res.json(datasets);
};

exports.getSpecificWorkspace = async (req, res) => {
  // const columns = await Workspace.findAll({
  //     where: {
  //         pog: req.params.pog
  //     }
  // });
  // const datasets = await Dataset.findAll({
  //     include: [req.params.pog, ...columns]
  // });
  // res.json(datasets);
};

exports.appearedInDBS = async (req, res) => {
  const { run_number, dataset_name } = req.body;
  const dataset = await Dataset.findOne({
    where: {
      run_number,
      name: dataset_name,
    },
  });
  let { appeared_in } = dataset.dataset_attributes;

  if (typeof appeared_in === 'undefined') {
    appeared_in = [];
  }
  if (appeared_in.includes('DBS')) {
    throw 'already marked as appeared in DBS';
  }
  const { atomic_version } = await create_new_version({
    req,
    comment: 'dataset appeared in DBS',
  });
  await exports.update_or_create_dataset({
    dataset_name,
    run_number,
    dataset_metadata: {
      appeared_in: appeared_in.concat('DBS'),
    },
    atomic_version,
  });
  const saved_dataset = await Dataset.findOne({
    where: {
      run_number,
      name: dataset_name,
    },
    include: [{ model: Run }, { model: DatasetTripletCache }],
  });
  res.json(saved_dataset);
};
// If a dataset appeared in DQM GUI we must mark it open inmediately (we must changed )
exports.appearedInDQMGUI = async (req, res) => {
  const { run_number, dataset_name } = req.body;
  const dataset = await Dataset.findOne({
    where: {
      run_number,
      name: dataset_name,
    },
  });

  let { appeared_in } = dataset.dataset_attributes;

  if (typeof appeared_in === 'undefined') {
    appeared_in = [];
  }
  if (appeared_in.includes('DQM GUI')) {
    throw 'already marked as appeared in DQM GUI';
  }
  const { atomic_version } = await create_new_version({
    req,
    comment: 'dataset appeared in DQM GUI',
  });
  await exports.update_or_create_dataset({
    dataset_name,
    run_number,
    dataset_metadata: {
      appeared_in: appeared_in.concat('DQM GUI'),
    },
    atomic_version,
  });
  const saved_dataset = await Dataset.findOne({
    where: {
      run_number,
      name: dataset_name,
    },
    include: [{ model: Run }, { model: DatasetTripletCache }],
  });

  res.json(saved_dataset);
  // // TODO: Decide if there is going to be one dataset_classifier per workspace
  // const dataset_classifiers = await OfflineDatasetClassifier.findAll();
  // dataset_classifiers.forEach(dataset_classifier => {
  //     const classifier = dataset_classifier.dataValues.classifier;
  //     const significant = json_logic.apply(classifier, dataset);
  //     const workspace = dataset_classifier.dataValues.workspace;
  //     if (significant === 'CREATE_DATASET') {
  //         dataset[`${workspace}_state`] = changeHistory(
  //             dataset[`${workspace}_state`],
  //             { value: 'OPEN' },
  //             author_dataset_classifier
  //         );
  //     }
  //     if (significant === 'IRRELEVANT') {
  //         dataset[`${workspace}_state`] = changeHistory(
  //             dataset[`${workspace}_state`],
  //             { value: 'OPEN' },
  //             author_dataset_classifier
  //         );
  //     }
  // });
};

const formatSortings = (sortings) => {
  return sortings.map((sorting) => {
    let [key, order] = sorting;
    if (key === 'oms_attributes.ls_duration') {
      key = sequelize.cast(
        sequelize.literal(`("Run"."oms_attributes"#>>'{ls_duration}')`),
        'INTEGER'
      );
    } else if (key === 'oms_attributes.b_field') {
      key = sequelize.cast(
        sequelize.literal(`("Run"."oms_attributes"#>>'{b_field}')`),
        'FLOAT'
      );
    } else if (key === 'rr_attributes.class') {
      key = sequelize.literal(`("Run"."rr_attributes"#>>'{class}')`);
    } else if (key.includes('-')) {
      key = sequelize.literal(
        `("DatasetTripletCache"."triplet_summary"#>>'{${key}}')`
      );
    }
    return [key, order];
  });
};

exports.getDatasetsFilteredOrdered = async (req, res) => {
  const [filter, include] = exports.calculate_dataset_filter_and_include(
    req.body.filter
  );
  // If a user filters by anything else:
  const { page, sortings, page_size } = req.body;
  const formated_sortings = formatSortings(sortings);
  const count = await Dataset.count({
    where: filter,
    include,
  });
  let pages = Math.ceil(count / page_size);
  let offset = page_size * page;
  let datasets = await Dataset.findAll({
    where: filter,
    order:
      formated_sortings.length > 0
        ? formated_sortings
        : [
            ['run_number', 'DESC'],
            ['name', 'ASC'],
          ],
    limit: page_size,
    offset,
    include,
  });
  res.json({ datasets, pages, count });
};

// Move manually a dataset from client:
exports.moveDataset = async (req, res) => {
  const { to_state } = req.params;
  const { run_number, dataset_name, workspace } = req.body;
  const dataset = await Dataset.findOne({
    where: { run_number, name: dataset_name },
    include: [
      {
        model: Run,
      },
    ],
  });
  const { dataset_attributes } = dataset;
  const new_dataset_attributes = {};
  // IF THE USER MOVES MANUALLY THE DATASET FROM GLOBAL (in global worksace) TO OPEN AND THE DATASET WAS WAITING DQM GUI IN OTHER WORKSPACES, IT IS MOVED FROM ALL TO OPEN:
  if (
    workspace === 'global' &&
    dataset_attributes.global_state === WAITING_DQM_GUI_CONSTANT &&
    to_state === 'OPEN'
  ) {
    for (const [dataset_attribute, value] of Object.entries(
      dataset_attributes
    )) {
      if (
        dataset_attribute.includes('_state') &&
        value === WAITING_DQM_GUI_CONSTANT
      ) {
        new_dataset_attributes[dataset_attribute] = to_state;
      }
    }
    // And finally in global:
    new_dataset_attributes[`${workspace}_state`] = to_state;
  } else {
    // Or else if a user just moved for an individual workspace other than global:
    new_dataset_attributes[`${workspace}_state`] = to_state;
  }
  const { atomic_version } = await create_new_version({
    req,
    comment: 'manual change of state of dataset',
  });

  await exports.update_or_create_dataset({
    dataset_name,
    run_number,
    dataset_metadata: new_dataset_attributes,
    atomic_version,
  });
  const saved_dataset = await Dataset.findOne({
    where: {
      run_number,
      name: dataset_name,
    },
    include: [{ model: Run }, { model: DatasetTripletCache }],
  });

  res.json(saved_dataset);
};

exports.manual_edit = async (req, res) => {
  const { workspace } = req.params;
  const { run_number, dataset_name } = req.body;
  const dataset = await Dataset.findOne({
    where: { run_number, name: dataset_name },
    include: [
      {
        model: Run,
      },
    ],
  });
  if (dataset === null) {
    throw 'Dataset not found';
  }
  const { dataset_attributes } = dataset;
  if (dataset_attributes[`${workspace}_state`] !== 'OPEN') {
    throw `Dataset is not in state OPEN for workspace: ${workspace}`;
  }

  const new_dataset_attributes = getObjectWithAttributesThatChanged(
    dataset_attributes,
    req.body.dataset_attributes
  );
  const new_attributes_length = Object.keys(new_dataset_attributes).length;
  if (new_attributes_length > 0) {
    const { atomic_version } = await create_new_version({
      req,
      comment: 'dataset manual update of attributes',
    });
    const datasetEvent = await update_or_create_dataset({
      dataset_name,
      run_number,
      dataset_metadata: new_dataset_attributes,
      atomic_version,
    });
  } else {
    throw 'Nothing to update, the attributes sent are the same as those in the dataset already stored';
  }
  const saved_dataset = await Dataset.findOne({
    where: {
      run_number,
      name: dataset_name,
    },
    include: [{ model: Run }, { model: DatasetTripletCache }],
  });
  res.json(saved_dataset);
};

// visualization on popover
exports.getLumisectionBar = async (req, res) => {
  const { run_number, dataset_name, component } = req.body;
  const rr_lumisections = await get_rr_lumisection_ranges_for_dataset(
    run_number,
    dataset_name
  );
  const rr_component_lumisection_ranges = rr_lumisections[component];
  if (typeof rr_component_lumisection_ranges === 'undefined') {
    throw 'Lumisection ranges not found for component';
  }
  res.json(rr_component_lumisection_ranges);
};

// DC TOOLS:

// It will duplicate existing datsets, if it fails for one, it fails for all and transaction is aborted
// It comes with a filter that comes from front end, we will query for the datasets that match the filter AND that are not in a 'waiting dqm gui' global_state
exports.duplicate_datasets = async (req, res) => {
  let {
    source_dataset_name,
    target_dataset_name,
    workspaces_to_duplicate_into,
  } = req.body;

  const [filter, include] = exports.calculate_dataset_filter_and_include(
    req.body.filter
  );

  const datasets_to_copy = await Dataset.findAll({
    where: filter,
    include,
  });
  if (datasets_to_copy.length === 0) {
    throw `No dataset found for filter criteria`;
  }

  // TODO: Validate that the workspace in 'workspaces_to_duplicate_into' actually exist:

  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { atomic_version } = await create_new_version({
      req,
      transaction,
      comment: 'dc_tool: duplication of datasets',
    });
    const promises = datasets_to_copy.map((dataset) => async () => {
      const { run_number } = dataset;
      // We go through the state of every workspace, if the user included that workspace in the "copy" tool, then we copy that. If not, then we don't
      // If the user didn't include a workspace, then the duplicated dataset will not appear in such workspace (because there is no state there)
      const new_dataset_attributes = {};
      for (const [key, val] of Object.entries(
        dataset.dataValues.dataset_attributes
      )) {
        if (key.includes('_state')) {
          const key_workspace = key.split('_state')[0];
          if (
            workspaces_to_duplicate_into.includes(key_workspace) ||
            key_workspace === 'global'
          ) {
            new_dataset_attributes[key] = val;
          }
        } else {
          // All other attributes not regarding state, we copy to the new_dataset_attributes:
          new_dataset_attributes[key] = val;
        }
      }

      // If there was a newly created workspace sent, and it wasn't saved before on the dataset, we should still add the state to the dataset, and set it to pending:
      // So that it shows up in the newly created workspace:
      workspaces_to_duplicate_into.forEach((workspace) => {
        new_dataset_attributes[`${workspace}_state`] =
          new_dataset_attributes[`${workspace}_state`] ||
          WAITING_DQM_GUI_CONSTANT;
      });

      await exports.update_or_create_dataset({
        dataset_name: target_dataset_name,
        run_number,
        dataset_metadata: new_dataset_attributes,
        atomic_version,
        transaction,
      });
      // We need to copy both RR and OMS lumisections in case later on someone wants to edit some OMS ls bit
      const original_rr_lumisections = await get_rr_lumisections_for_dataset(
        run_number,
        source_dataset_name
      );
      const original_oms_lumisections = await get_oms_lumisections_for_dataset(
        run_number,
        source_dataset_name
      );
      const new_rr_lumisections = await create_rr_lumisections({
        run_number,
        dataset_name: target_dataset_name,
        lumisections: original_rr_lumisections,
        req,
        atomic_version,
        transaction,
      });
      const new_oms_lumisections = await create_oms_lumisections({
        run_number,
        dataset_name: target_dataset_name,
        lumisections: original_oms_lumisections,
        req,
        atomic_version,
        transaction,
      });
    });

    const number_of_workers = 1;
    const asyncQueue = queue(
      async (dataset) => await dataset(),
      number_of_workers
    );

    asyncQueue.drain = async () => {
      // We only commit when the datasets are already duplicated
      await transaction.commit();
      console.log(`${datasets_to_copy.length} duplicated`);
      // You can only fill the cache when transaction has commited:
      await fill_dataset_triplet_cache();
      const saved_datasets_promises = datasets_to_copy.map(
        async ({ run_number }) => {
          const saved_dataset = await Dataset.findOne({
            where: {
              run_number,
              name: target_dataset_name,
            },
            include: [
              {
                model: Run,
                attributes: ['rr_attributes', 'oms_attributes'],
              },
              { model: DatasetTripletCache },
            ],
          });
          return saved_dataset;
        }
      );
      const saved_datasets = await Promise.all(saved_datasets_promises);
      res.json(saved_datasets);
    };

    asyncQueue.push(promises);
  } catch (err) {
    console.log('Error duplicating datasets');
    console.log(err);
    await transaction.rollback();
    throw `Error duplicating datasets: ${err.message}`;
  }
};

// When copying a column from say prompt to rereco:
// Classic example is, certain subsystem messed up the RERECO and batched change one column to BAD and they want a reset, so we need to copy from Prompt again
exports.copy_column_from_datasets = async (req, res) => {
  const {
    source_dataset_name,
    target_dataset_name,
    columns_to_copy,
  } = req.body;
  const [filter, include] = exports.calculate_dataset_filter_and_include(
    req.body.filter
  );

  const datasets_to_copy = await Dataset.findAll({
    where: filter,
    include,
  });
  if (datasets_to_copy.length === 0) {
    throw `No dataset found for filter criteria`;
  }
  // Validate there can only exist the dataset_from and the dataset_to
  datasets_to_copy.forEach(({ name, run_number }) => {
    if (name !== source_dataset_name && name !== target_dataset_name) {
      throw `The current filter selection matches more datasets than the ones specified, which where dataset to copy from: ${source_dataset_name} and the dataset to copy to: ${target_dataset_name}`;
    }
  });

  const source_datasets = datasets_to_copy.filter(
    ({ name }) => name === source_dataset_name
  );
  const target_datasets = datasets_to_copy.filter(
    ({ name }) => name === target_dataset_name
  );

  if (source_datasets.length !== target_datasets.length) {
    throw `there must be a one to one relationship between source and target datasets`;
  }

  const tuple_of_dataset_source_target = [];
  source_datasets.forEach((dataset) => {
    const tuple = [dataset];
    target_datasets.forEach((target_dataset) => {
      if (dataset.run_number === target_dataset.run_number) {
        tuple.push(target_dataset);
      }
    });
    // Validate there is a one to one relationship
    if (tuple.length !== 2) {
      throw `There must te a one to one relationship between source and target datasets`;
    }
    tuple_of_dataset_source_target.push(tuple);
  });
  // Both OMS and RR lumisections need to be copied:
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { atomic_version } = await create_new_version({
      req,
      transaction,
      comment:
        'dc_tool: copy column of lumisections from certain datasets to certain datasets',
    });
    const promises = tuple_of_dataset_source_target.map(
      ([dataset_source, dataset_target]) => async () => {
        const {
          name: name_source,
          run_number: run_number_source,
        } = dataset_source;

        const {
          name: name_target,
          run_number: run_number_target,
        } = dataset_target;

        // We need to copy only the RR flag they selected
        const source_rr_lumisections = await get_rr_lumisections_for_dataset(
          run_number_source,
          name_source
        );

        const filtered_rr_lumisections = source_rr_lumisections.map(
          (lumisection) => {
            columns_to_copy.map((column) => {
              if (typeof lumisection[column] === 'undefined') {
                throw `Column ${column} does not exist in the source dataset ${name_source} ${run_number_source}`;
              }
            });
            const new_lumisection = getAttributesSpecifiedFromArray(
              lumisection,
              columns_to_copy
            );
            return new_lumisection;
          }
        );

        const new_rr_lumisections = await create_rr_lumisections({
          run_number: run_number_target,
          dataset_name: name_target,
          lumisections: filtered_rr_lumisections,
          req,
          atomic_version,
          transaction,
        });
        // We bump the version of the datasetevent table so it knows which datasets to regenerate in the cache
        await exports.update_or_create_dataset({
          dataset_name: name_target,
          run_number: run_number_target,
          dataset_metadata: {},
          atomic_version,
          transaction,
        });
      }
    );
    const number_of_workers = 1;
    const asyncQueue = queue(
      async (dataset) => await dataset(),
      number_of_workers
    );

    asyncQueue.drain = async () => {
      // We only commit when the datasets are already duplicated
      await transaction.commit();
      console.log(`${datasets_to_copy.length} duplicated`);
      // You can only fill the cache when transaction has commited:
      await fill_dataset_triplet_cache();
      const saved_datasets_promises = target_datasets.map(
        async ({ run_number, name }) => {
          const saved_dataset = await Dataset.findOne({
            where: {
              run_number,
              name,
            },
            include: [
              {
                model: Run,
                attributes: ['rr_attributes'],
              },
              { model: DatasetTripletCache },
            ],
          });
          return saved_dataset;
        }
      );
      const saved_datasets = await Promise.all(saved_datasets_promises);
      res.json(saved_datasets);
    };

    asyncQueue.push(promises);
  } catch (e) {
    console.log('Error duplicating column of datasets');
    console.log(err);
    await transaction.rollback();
    throw `Error duplicating datasets: ${err.message}`;
  }
};

exports.change_multiple_states_in_all_workspaces = (req, res) => {
  req.body.change_in_all_workspaces = true;
  return exports.change_multiple_states(req, res);
};

exports.change_multiple_states = async (req, res) => {
  const { change_in_all_workspaces } = req.body;
  const { workspace_to_change_state_in, from_state, to_state } = req.params;
  const [filter, include] = exports.calculate_dataset_filter_and_include(
    req.body.filter
  );

  // TODO: Validate workspace exists:
  if (!workspace_to_change_state_in && !change_in_all_workspaces) {
    throw 'Workspace to change state must be provided';
  }
  if (!['COMPLETED', 'SIGNOFF', 'OPEN'].includes(to_state)) {
    throw 'The new state must be either COMPLETED, SIGNOFF or OPEN';
  }
  const datasets_to_change_state = await Dataset.findAll({
    where: filter,
    include,
  });
  if (datasets_to_change_state.length === 0) {
    throw `No dataset found for filter criteria`;
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { atomic_version } = await create_new_version({
      req,
      transaction,
      overwriteable_comment: `dc_tool: change multiple states (OPEN, SIGNOFF, COMPLETED) of datasets in batch ${
        change_in_all_workspaces
          ? '(in all workspaces)'
          : `from state ${from_state} to ${to_state} in workspace ${workspace_to_change_state_in}`
      }`,
    });
    const promises = datasets_to_change_state.map(async (dataset) => {
      const { name, run_number, dataset_attributes } = dataset;
      let dataset_metadata = {};
      if (change_in_all_workspaces) {
        dataset_metadata = { ...dataset_attributes };
        for (const [key, val] of Object.entries(dataset_attributes)) {
          if (key.includes('_state')) {
            dataset_metadata[key] = to_state;
          }
        }
      } else {
        const current_state =
          dataset_attributes[`${workspace_to_change_state_in}_state`];
        if (!current_state) {
          throw `No state defined for ${run_number} in ${name} in workspace ${workspace_to_change_state_in}, cannot change state`;
        }
        if (current_state === from_state) {
          dataset_metadata[`${workspace_to_change_state_in}_state`] = to_state;
        }
      }
      await exports.update_or_create_dataset({
        dataset_name: name,
        run_number,
        dataset_metadata,
        atomic_version,
        transaction,
      });
    });
    await Promise.all(promises);
    await transaction.commit();
    const saved_datasets_promises = datasets_to_change_state.map(
      async ({ run_number, name }) => {
        const saved_dataset = await Dataset.findOne({
          where: {
            run_number,
            name,
          },
          include: [
            {
              model: Run,
              attributes: ['rr_attributes', 'oms_attributes', 'oms_attributes'],
            },
            {
              model: DatasetTripletCache,
              attributes: ['triplet_summary', 'dcs_summary'],
            },
          ],
        });
        return saved_dataset;
      }
    );
    const saved_datasets = await Promise.all(saved_datasets_promises);
    res.json(saved_datasets);
    // We refill the dataset triplet cache, even though its not necessary, we do it to keep the max version synced
    await fill_dataset_triplet_cache();
  } catch (err) {
    console.log('Error changing states in batch');
    console.log(err);
    await transaction.rollback();
    throw `Error duplicating datasets: ${err}`;
  }
};

exports.datasetColumnBatchUpdate = async (req, res) => {
  const [filter, include] = exports.calculate_dataset_filter_and_include(
    req.body.filter
  );
  const { columns_to_update, new_status } = req.body;
  const datasets_to_update = await Dataset.findAll({
    where: filter,
    include,
  });
  if (datasets_to_update.length === 0) {
    throw `No dataset found for filter criteria`;
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { atomic_version } = await create_new_version({
      req,
      transaction,
      comment:
        'dc_tool: change column of lumisections to a certain state (GOOD,BAD) in batch',
    });
    const promises = datasets_to_update.map((dataset) => async () => {
      const { name, run_number } = dataset;

      const rr_lumisections = await get_rr_lumisections_for_dataset(
        run_number,
        name
      );

      const changed_lumisections = rr_lumisections.map((lumisection) => {
        columns_to_update.map((column) => {
          if (typeof lumisection[column] === 'undefined') {
            throw `Column ${column} does not exist in the source dataset ${name} ${run_number}`;
          }
        });
        const new_lumisection = getAttributesSpecifiedFromArray(
          lumisection,
          columns_to_update
        );
        for (const [key, val] of Object.entries(new_lumisection)) {
          new_lumisection[key] = { ...val, status: new_status };
        }
        return new_lumisection;
      });
      const new_rr_lumisections = await create_rr_lumisections({
        run_number,
        dataset_name: name,
        lumisections: changed_lumisections,
        req,
        atomic_version,
        transaction,
      });
      // We bump the version of the datasetevent table so it knows which datasets to regenerate in the cache
      await exports.update_or_create_dataset({
        dataset_name: name,
        run_number,
        dataset_metadata: {},
        atomic_version,
        transaction,
      });
    });

    const number_of_workers = 1;
    const asyncQueue = queue(
      async (dataset) => await dataset(),
      number_of_workers
    );

    asyncQueue.drain = async () => {
      // We only commit when columns are already changed in batch
      await transaction.commit();
      // You can only fill the cache when transaction has commited:
      await fill_dataset_triplet_cache();
      const saved_datasets_promises = datasets_to_update.map(
        async ({ run_number, name }) => {
          const saved_dataset = await Dataset.findOne({
            where: {
              run_number,
              name,
            },
            include: [
              {
                model: Run,
                attributes: ['rr_attributes', 'oms_attributes'],
              },
              { model: DatasetTripletCache },
            ],
          });
          return saved_dataset;
        }
      );
      const saved_datasets = await Promise.all(saved_datasets_promises);
      res.json(saved_datasets);
    };

    asyncQueue.push(promises);
  } catch (e) {
    console.log('Error updating status of datasets in batch');
    console.log(err);
    await transaction.rollback();
    throw `Error updating status of column of datasets in batch: ${err.message}`;
  }
};

exports.hide_datasets = async (req, res) => {
  const { reason_for_hiding } = req.body;
  const [filter, include] = exports.calculate_dataset_filter_and_include(
    req.body.filter
  );
  if (!reason_for_hiding) {
    throw 'You must provide a reason for hiding these datasets';
  }

  const datasets_to_hide = await Dataset.findAll({
    where: filter,
    include,
  });
  if (datasets_to_hide.length === 0) {
    throw `No dataset(s) found for filter criteria`;
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { atomic_version } = await create_new_version({
      req,
      transaction,
      overwriteable_comment: `dc_tool: hiding datasets, reason: ${reason_for_hiding}`,
    });
    const promises = datasets_to_hide.map(async (dataset) => {
      const { name, run_number } = dataset;
      if (name === 'online') {
        throw 'You cannot delete the online dataset belonging to a run';
      }
      await exports.update_or_create_dataset({
        dataset_name: name,
        run_number,
        atomic_version,
        dataset_metadata: {},
        transaction,
        delete_dataset: true,
      });
    });
    await Promise.all(promises);
    await fill_dataset_triplet_cache();
    await transaction.commit();
    res.json(datasets_to_hide);
  } catch (e) {
    console.log('Error hiding datasets');
    console.log(err);
    await transaction.rollback();
    throw `Error hiding datasets: ${err}`;
  }
};

exports.export_to_csv = async (req, res) => {
  const [filter, include] = exports.calculate_dataset_filter_and_include(
    req.body.filter
  );
  const { columns, sortings } = req.body;
  let datasets = await Dataset.findAll({
    where: filter,
    order:
      sortings.length > 0
        ? sortings
        : [
            ['run_number', 'DESC'],
            ['name', 'ASC'],
          ],
    include,
  });

  datasets = datasets.map(({ dataValues }) => {
    const {
      run_number,
      name,
      dataset_attributes,
      DatasetTripletCache,
      Run,
    } = dataValues;
    const { rr_attributes, oms_attributes } = Run.dataValues;
    const { stop_reason, short_run } = rr_attributes;
    const { ls_duration } = oms_attributes;
    const dataset_shown_values = {
      run_number,
      dataset_name: name,
      class: rr_attributes.class,
      stop_reason,
      short_run,
      ls_duration,
      ...dataset_attributes,
    };
    const { triplet_summary } = DatasetTripletCache;
    for (const [key, val] of Object.entries(triplet_summary)) {
      if (columns.includes(key)) {
        dataset_shown_values[key] = val;
      }
    }
    dataset_shown_values.oms_attributes = oms_attributes;
    return dataset_shown_values;
  });

  const csv = csv_stringify(datasets, { header: true });
  res.json(csv);
};

// Given some run_numbers (provided in filter), get all the dataset names:
exports.getUniqueDatasetNames = async (req, res) => {
  let [filter, include] = exports.calculate_dataset_filter_and_include(
    req.body.filter
  );

  const datasets_filter_criteria = await Dataset.findAll({
    attributes: ['name'],
    where: filter,
    include,
  });
  if (datasets_filter_criteria.length > 12000) {
    throw `Dataset query too big, limit is 12000`;
  }
  const unique_dataset_names_object = {};
  datasets_filter_criteria.forEach(({ name }) => {
    unique_dataset_names_object[name] = name;
  });
  const unique_dataset_names = Object.keys(unique_dataset_names_object);

  res.json(unique_dataset_names);
};

const getTripletSummaryFilter = (filter, contains_something) => {
  const triplet_filter = {};
  for (const [key, val] of Object.entries(filter)) {
    if (key.startsWith('triplet_summary')) {
      triplet_filter[key] = val;
      contains_something = true;
    } else if (key === 'and' || key === 'or') {
      triplet_filter[key] = val
        .filter((rule) => {
          const [new_rule, new_contains_something] = getTripletSummaryFilter(
            rule,
            contains_something
          );
          return new_contains_something;
        })
        .map((rule) => {
          const [new_rule, new_contains_something] = getTripletSummaryFilter(
            rule,
            contains_something
          );
          contains_something = new_contains_something;
          return new_rule;
        });
    }
  }
  return [triplet_filter, contains_something];
};

const getRunFilter = (filter, contains_something) => {
  const new_filter = {};
  for (const [key, val] of Object.entries(filter)) {
    if (key.startsWith('rr_attributes.')) {
      // const column_key = key.split('rr_attributes.')[1];
      new_filter[key] = val;
      contains_something = true;
    } else if (key.startsWith('oms_attributes.')) {
      // const column_key = key.split('oms_attributes.')[1];
      new_filter[key] = val;
      contains_something = true;
    } else if (key === 'and' || key === 'or') {
      new_filter[key] = val
        .filter((rule) => {
          const [new_rule, new_contains_something] = getRunFilter(
            rule,
            contains_something
          );
          return new_contains_something;
        })
        .map((rule) => {
          const [new_rule, new_contains_something] = getRunFilter(
            rule,
            contains_something
          );
          contains_something = new_contains_something;
          return new_rule;
        });
    }
  }
  return [new_filter, contains_something];
};

const getDatasetFilter = (filter, contains_something) => {
  const new_filter = {};
  for (const [key, val] of Object.entries(filter)) {
    if (
      key.startsWith('triplet_summary') ||
      key.startsWith('rr_attributes') ||
      key.startsWith('oms_attributes')
    ) {
      delete new_filter[key];
    } else if (key === 'and' || key === 'or') {
      new_filter[key] = val
        .filter((rule) => {
          const [new_rule, new_contains_something] = getDatasetFilter(
            rule,
            contains_something
          );
          return new_contains_something;
        })
        .map((rule) => {
          const [new_rule, new_contains_something] = getDatasetFilter(
            rule,
            contains_something
          );
          contains_something = new_contains_something;
          return new_rule;
        });
    } else {
      if (key.startsWith('datasets_in_gui')) {
        new_filter[key] = { contains: Object.values(val)[0] };
      } else {
        new_filter[key] = val;
      }
      contains_something = true;
    }
  }
  return [new_filter, contains_something];
};

exports.calculate_dataset_filter_and_include = (client_filter) => {
  // A user can filter on triplets, or on any other field
  // If the user filters by triplets, then :
  let [dataset_filter, dataset_filter_exists] = getDatasetFilter(
    client_filter,
    false
  );
  if (!dataset_filter_exists) {
    dataset_filter = {};
  }
  let [run_filter, run_filter_exists] = getRunFilter(client_filter, false);
  if (!run_filter_exists) {
    run_filter = {};
  }
  run_filter = changeNameOfAllKeys(run_filter, conversion_operator);
  let [triplet_summary_filter, triplet_filter_exists] = getTripletSummaryFilter(
    client_filter,
    false
  );
  if (!triplet_filter_exists) {
    triplet_summary_filter = {};
  }
  triplet_summary_filter = changeNameOfAllKeys(
    triplet_summary_filter,
    conversion_operator
  );

  let filter = {
    ...changeNameOfAllKeys(dataset_filter, conversion_operator),
    deleted: false,
  };
  // If its filtering by run class, then include it in run filter
  let include = [
    {
      model: Run,
      attributes: ['rr_attributes', 'oms_attributes'],
      where: run_filter,
    },
    {
      model: DatasetTripletCache,
      where: triplet_summary_filter,
      attributes: ['triplet_summary', 'dcs_summary'],
    },
  ];
  return [filter, include];
};
