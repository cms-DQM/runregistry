const getObjectWithAttributesThatChanged = require('get-object-with-attributes-that-changed');
const changeNameOfAllKeys = require('change-name-of-all-keys');

const Sequelize = require('../models').Sequelize;
const sequelize = require('../models').sequelize;

const { certifiable_online_components } = require('../config/config');

const {
  create_oms_lumisections,
  create_rr_lumisections,
  update_oms_lumisections,
  update_rr_lumisections,
  get_rr_lumisections_for_dataset,
} = require('./lumisection');
const { update_or_create_dataset } = require('./dataset');
const { create_new_version } = require('./version');
const { fill_dataset_triplet_cache } = require('./dataset_triplet_cache');
const { manually_update_a_run } = require('../cron/2.save_or_update_runs');
const {
  create_offline_waiting_datasets,
} = require('../cron_datasets/1.create_datasets');
const {
  Run,
  Dataset,
  DatasetTripletCache,
  Event,
  RunEvent,
  Version,
} = require('../models');

const update_or_create_run = async ({
  run_number,
  oms_metadata,
  rr_metadata,
  atomic_version,
  req,
  transaction,
}) => {
  run_number = +run_number;
  const by = req.email || req.get('email');
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
    let manual_change = false;
    // If the email is not auto@auto, it means it was a manual change, therefore later on, when we order changes, we give priority to the manual change
    if (!by.startsWith('auto@auto')) {
      manual_change = true;
      if (Object.keys(oms_metadata).length !== 0) {
        throw 'Manual change must have empty oms_metadata';
      }
    }
    const runEvent = await RunEvent.create(
      {
        run_number,
        oms_metadata,
        rr_metadata,
        version: event.version,
        deleted: false,
        manual_change,
      },
      { transaction }
    );
    // update the Run table, we are creating temporary tables to prevent the postgres optimizer to do unnecessary scans of whole table
    // The ORDER BY in mergejsonb first orders by manual_change (shifters actions overwrite automatic changes )
    await sequelize.query(
      `
                CREATE TEMPORARY TABLE updated_runnumbers as SELECT DISTINCT "run_number" from "RunEvent" where "RunEvent"."version" > (SELECT COALESCE((SELECT MAX("version") from "Run"), 0));
                CREATE TEMPORARY TABLE updated_runs as SELECT * FROM "RunEvent"
                WHERE "RunEvent"."run_number" IN (
                    SELECT * from updated_runnumbers
                );

                INSERT INTO "Run" (run_number, rr_attributes, oms_attributes, deleted, "version")
                SELECT run_number,
                        mergejsonb(rr_metadata ORDER BY manual_change, version),
                        mergejsonb(oms_metadata ORDER BY version),
                        (SELECT deleted from "RunEvent" WHERE "version" = (SELECT max(version) FROM updated_runs)) AS "deleted",
                        (SELECT max(version) FROM "RunEvent" ) AS "version"
                FROM updated_runs
                GROUP BY run_number
                ON CONFLICT (run_number) DO UPDATE SET "rr_attributes" = EXCLUDED."rr_attributes", "oms_attributes" = EXCLUDED."oms_attributes", "deleted" = EXCLUDED."deleted", "version" = EXCLUDED.version;

                DROP TABLE updated_runnumbers;
                DROP TABLE updated_runs;
        `,
      { transaction }
    );
    if (local_transaction) {
      await transaction.commit();
    }
    return runEvent;
  } catch (err) {
    // Rollback transaction if any errors were encountered
    console.log(err);
    if (local_transaction) {
      await transaction.rollback();
    }
    throw `Error updating/saving run ${run_number}, ${err.message}`;
  }
};
exports.update_or_create_run = update_or_create_run;

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
};

exports.getAll = async (req, res) => {
  const runs = await Run.findAll({
    order: [['run_number', 'DESC']],
  });
  res.json(runs);
};

exports.getOne = async (req, res) => {
  const run = await Run.findByPk(req.params.run_number, {
    include: [
      {
        model: DatasetTripletCache,
        attributes: ['triplet_summary'],
      },
    ],
  });
  res.json(run);
};

exports.getLastUpdated50 = async (req, res) => {
  const runs = await Run.findAll({
    order: [['oms_attributes.last_update', 'DESC']],
    limit: 50,
  });
  res.json(runs);
};

exports.getRunWithHistory = async (req, res) => {
  let run_events = await RunEvent.findAll({
    where: {
      run_number: req.params.run_number,
    },
    order: [['version', 'ASC']],
    include: [{ model: Event, include: [{ model: Version }] }],
  });
  run_events = run_events.map(
    ({ oms_metadata, rr_metadata, run_number, version, Event, Version }) => ({
      ...oms_metadata,
      ...rr_metadata,
      run_number,
      version,
      ...Event.dataValues,
      ...Event.Version.dataValues,
    })
  );
  res.json(run_events);
};

exports.new = async (req, res) => {
  // TODO: validate run attributes
  const {
    oms_attributes,
    rr_attributes,
    oms_lumisections,
    rr_lumisections,
  } = req.body;
  const { run_number } = oms_attributes;
  const run = await Run.findByPk(run_number);
  if (run !== null) {
    // Run already exists, we update it
    await exports.automatic_run_update(req, res);
    return;
  }
  // Initialize run:
  rr_attributes.stop_reason = '';
  rr_attributes.state = 'OPEN';
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { atomic_version } = await create_new_version({
      req,
      transaction,
      comment: 'run creation',
    });
    const runEvent = await update_or_create_run({
      run_number,
      oms_metadata: oms_attributes,
      rr_metadata: rr_attributes,
      req,
      atomic_version,
      transaction,
    });
    const datasetEvent = await update_or_create_dataset({
      dataset_name: 'online',
      run_number,
      dataset_metadata: {},
      atomic_version,
      transaction,
    });
    if (rr_lumisections.length > 0 || oms_lumisections.length > 0) {
      const saved_oms_lumisections = await create_oms_lumisections({
        run_number,
        dataset_name: 'online',
        lumisections: oms_lumisections,
        req,
        atomic_version,
        transaction,
      });

      const saved_rr_lumisections = await create_rr_lumisections({
        run_number,
        dataset_name: 'online',
        lumisections: rr_lumisections,
        req,
        atomic_version,
        transaction,
      });
    }
    await transaction.commit();
    // You can only fill the cache when transaction has commited:
    await fill_dataset_triplet_cache();
    res.json(runEvent);
  } catch (err) {
    console.log(err);
    await transaction.rollback();
    throw `Error saving run ${run_number}`;
  }
};

// This updates the run (triggered by an OMS update) not to be confused with an manual edition of a run
// The new_attributes are a collection of the attributes that changed with respect to the run
exports.automatic_run_update = async (req, res) => {
  const { run_number } = req.params;

  const run = await Run.findByPk(run_number);
  if (run === null) {
    // Run doesn't exist, we create it
    console.log('Trying to update run when we need to create it first');
    await exports.new(req, res);
    return;
  }
  const { oms_attributes, rr_attributes } = run.dataValues;
  let was_run_updated = false;
  let transaction;
  try {
    transaction = await sequelize.transaction();
    let atomic_version;
    if (req.body.atomic_version) {
      atomic_version = req.body.atomic_version;
    } else {
      const version_result = await create_new_version({
        req,
        transaction,
        comment: 'run automatic update',
      });
      atomic_version = version_result.atomic_version;
    }

    // Lumisection stuff:
    const { oms_lumisections, rr_lumisections } = req.body;
    const newRRLumisectionRanges = await update_rr_lumisections({
      run_number,
      dataset_name: 'online',
      new_lumisections: rr_lumisections,
      req,
      atomic_version,
      transaction,
    });
    if (newRRLumisectionRanges.length > 0) {
      if (rr_attributes.state === 'OPEN') {
        // There was a change in RR lumisections, we should update oms lumisections as well:
        const newOMSLumisectionRange = await update_oms_lumisections({
          run_number: run_number,
          dataset_name: 'online',
          new_lumisections: oms_lumisections,
          req,
          atomic_version,
          transaction,
        });
        // Bump the version in the dataset so the fill_dataset_triplet_cache will know that the lumisections inside it changed, and so can refill the cache:
        const datasetEvent = await update_or_create_dataset({
          dataset_name: 'online',
          run_number,
          dataset_metadata: {},
          atomic_version,
          transaction,
        });
        was_run_updated = true;
      } else {
        // We need to flag the run and abort transaction, if it was not already flagged of course
        if (rr_attributes.run_needs_to_be_updated_manually !== true) {
          const { atomic_version } = await create_new_version({
            req,
            overwriteable_comment:
              'run flagged: run is not in OPEN state, received update from OMS which affected the RR Lumisections. It needs revision',
          });
          // Notice we do not pass transaction in the following call
          const runEvent = await update_or_create_run({
            run_number,
            oms_metadata: {},
            rr_metadata: { run_needs_to_be_updated_manually: true },
            atomic_version,
            req,
          });
          throw 'Run is not in state OPEN, and received update from OMS which affected the RR Lumisections, it is now flagged so that it is later updated manually';
        }
      }
    }

    // Now that the run is over, we update the OMS LSs as well when we receive an update
    if (!was_run_updated && oms_attributes.end_time !== null) {
      const newOMSLumisectionRange = await update_oms_lumisections({
        run_number: run_number,
        dataset_name: 'online',
        new_lumisections: oms_lumisections,
        req,
        atomic_version,
        transaction,
      });
      // If there were some LSs to change:
      if (newOMSLumisectionRange.length > 0) {
        was_run_updated = true;
      }
    }

    const new_oms_attributes = getObjectWithAttributesThatChanged(
      oms_attributes,
      req.body.oms_attributes
    );
    const new_rr_attributes = getObjectWithAttributesThatChanged(
      rr_attributes,
      req.body.rr_attributes
    );
    const new_rr_attributes_length = Object.keys(new_rr_attributes).length;
    const new_oms_attributes_length = Object.keys(new_oms_attributes).length;

    if (new_oms_attributes_length > 0) {
      if (req.body.oms_attributes.end_time !== null) {
        // If there are new OMS attributes and the run is already over, we are interested in them
        was_run_updated = true;
      }
    }

    if (
      new_rr_attributes_length > 0 &&
      rr_attributes.state !== 'OPEN' &&
      rr_attributes.run_needs_to_be_updated_manually !== true
    ) {
      // Notice we don't pass a transacion here:
      const { atomic_version } = await create_new_version({
        req,
        overwriteable_comment:
          'run flagged: run is not in OPEN state, received update from OMS which affected the rr_attributes of the run. It needs revision',
      });
      // If there are new RR attributes and the run is no longer in state OPEN, the run needs to be flagged:
      const runEvent = await update_or_create_run({
        run_number,
        oms_metadata: {},
        rr_metadata: { run_needs_to_be_updated_manually: true },
        atomic_version,
        req,
      });
      throw 'Run is not in state OPEN, and received update from OMS which affected the rr_attributes of the run, it is now flagged so that it is later updated manually';
    }
    // If there was actually something to update in the RR attributes, we update it, if it was a change in oms_attributes, we don't update it (since it doesn't affect RR attributes) unless the run is already over.
    if (new_rr_attributes_length > 0 || was_run_updated) {
      const runEvent = await update_or_create_run({
        run_number,
        oms_metadata: new_oms_attributes,
        rr_metadata: new_rr_attributes,
        req,
        atomic_version,
        transaction,
      });
      was_run_updated = true;
    }
    if (was_run_updated) {
      await transaction.commit();
      await fill_dataset_triplet_cache();
      console.log(`updated run ${run_number}`);
      const run = await Run.findByPk(run_number, {
        include: [
          {
            model: DatasetTripletCache,
            attributes: ['triplet_summary'],
          },
        ],
      });
      res.json(run.dataValues);
    } else {
      // Nothing changed so we remove the version since having a version without any change is useless:
      await transaction.rollback();
      res.status(204);
      res.send();
    }
  } catch (err) {
    console.log(err);
    await transaction.rollback();
    throw `Error updating run ${run_number}`;
  }
};

// In order to update the lumisections, one does it directly in lumisection.js edit_rr_lumsiections
// For run (class, stop_reason) its here:
exports.manual_edit = async (req, res) => {
  const { run_number } = req.params;

  const run = await Run.findByPk(run_number);
  if (run === null) {
    throw 'Run not found';
  }
  const { rr_attributes } = run.dataValues;
  if (rr_attributes.state !== 'OPEN') {
    throw 'Run must be in state OPEN to be edited';
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { atomic_version } = await create_new_version({
      req,
      transaction,
      comment: 'run manual edit',
    });
    const new_rr_attributes = getObjectWithAttributesThatChanged(
      rr_attributes,
      req.body.rr_attributes
    );
    const new_rr_attributes_length = Object.keys(new_rr_attributes).length;
    // If there was actually something to update in the RR attributes, we update it, if it was a change in oms_attributes, we don't update it (since it doesn't affect RR attributes)
    if (new_rr_attributes_length > 0) {
      const runEvent = await update_or_create_run({
        run_number,
        oms_metadata: {},
        rr_metadata: new_rr_attributes,
        req,
        atomic_version,
        transaction,
      });
      console.log(`updated run ${run_number}`);
    }
    await transaction.commit();
    // Now that it is commited we should find the updated run:
    const run = await Run.findByPk(run_number, {
      include: [
        {
          model: DatasetTripletCache,
          attributes: ['triplet_summary'],
        },
      ],
    });
    res.json(run.dataValues);
  } catch (err) {
    console.log(err);
    await transaction.rollback();
    throw `Error updating run ${run_number}`;
  }
};

exports.markSignificant = async (req, res) => {
  const { run_number } = req.body;
  const run = await Run.findByPk(run_number, {
    include: [
      {
        model: DatasetTripletCache,
        attributes: ['triplet_summary'],
      },
    ],
  });
  if (run === null) {
    throw 'Run not found';
  }
  if (run.rr_attributes.state !== 'OPEN') {
    throw 'Run must be in state OPEN to be marked significant';
  }
  if (run.rr_attributes.significant === true) {
    throw 'Run is already significant';
  }

  const oms_metadata = {};
  const rr_metadata = { significant: true };
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { atomic_version } = await create_new_version({
      req,
      transaction,
      comment: 'mark run significant',
    });
    await update_or_create_run({
      run_number,
      oms_metadata,
      rr_metadata,
      req,
      atomic_version,
      transaction,
    });
    await transaction.commit();
    // We do this to make sure the LUMISECTIONS classification are there
    const email = req.get('email');
    await manually_update_a_run(run_number, {
      email,
      manually_significant: true,
      comment: `${email} marked run significant, component statuses refreshed`,
      atomic_version,
    });
    const updated_run = await Run.findByPk(run_number, {
      include: [
        {
          model: DatasetTripletCache,
          attributes: ['triplet_summary'],
        },
      ],
    });
    res.json(updated_run);
  } catch (e) {
    console.log('Error marking run significant');
    console.log(err);
    await transaction.rollback();
    throw `Error marking run significant: ${err.message}`;
  }
};

exports.refreshRunClassAndComponents = async (req, res) => {
  const { run_number } = req.params;
  const email = req.get('email');
  const previously_saved_run = await Run.findByPk(run_number);
  if (previously_saved_run === null) {
    throw 'Run not found';
  }
  if (previously_saved_run.rr_attributes.state !== 'OPEN') {
    throw 'Run must be in state OPEN to be refreshed';
  }

  await manually_update_a_run(run_number, {
    email,
    comment: `${email} requested refresh from OMS`,
  });
  const saved_run = await Run.findByPk(run_number, {
    include: [
      {
        model: DatasetTripletCache,
        attributes: ['triplet_summary'],
      },
    ],
  });
  res.json(saved_run);
};

exports.moveRun = async (req, res) => {
  const { to_state } = req.params;
  const { run_number } = req.body;
  const run = await Run.findByPk(run_number);
  // Validation
  if (!['SIGNOFF', 'OPEN', 'COMPLETED'].includes(to_state)) {
    throw 'The final state must be SIGNOFF, OPEN OR COMPLETED, no other option is valid';
  }
  if (run.rr_attributes.state === to_state) {
    throw `Run ${run_number} state is already in state ${to_state}`;
  }

  // Check if triplets are empty quotes:
  const rr_lumisections = await get_rr_lumisections_for_dataset(
    run_number,
    'online'
  );
  if (rr_lumisections.length === 0) {
    throw `There is no run lumisection data for run ${run_number}, therefore it cannot be signed off`;
  }
  // Check for NO VALUE FOUND lumisections:
  for (let i = 0; i < rr_lumisections.length; i++) {
    const current_lumisection = rr_lumisections[i];
    for (const [key, val] of Object.entries(current_lumisection)) {
      const [workspace, column] = key.split('-');
      // Only validate for GLOBAL WORKSPACE (or certifiable component's)
      if (
        certifiable_online_components[workspace] &&
        certifiable_online_components[workspace].includes(column) &&
        (to_state === 'SIGNOFF' || to_state === 'COMPLETED')
      ) {
        if (
          val.status === '' ||
          val.status === 'EMPTY' ||
          val.status === 'NO VALUE FOUND'
        ) {
          const subsystem = key.split('-')[1];
          const ls_position = i + 1;
          const empty_verbose = val.status || 'empty'; // Will make empty string coerce to 'empty'
          throw `There is a ${empty_verbose} lumisection at position ${ls_position} of this run in component ${subsystem}. 
                           Please wait until this component is updated automatically (<5 mins), or ask ${subsystem} expert, then change the value in the 'manage' menu.`;
        }
      }
    }
  }
  //      Check if run class is empty:
  if (run.dataValues.rr_attributes.class === '') {
    throw 'The class of run must not be empty ';
  }
  // End validation
  const oms_metadata = {};
  const rr_metadata = { state: to_state };
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { atomic_version } = await create_new_version({
      req,
      transaction,
      comment: 'move state (e.g. OPEN, SIGNOFF) of run',
    });
    await update_or_create_run({
      run_number,
      oms_metadata,
      rr_metadata,
      atomic_version,
      req,
      transaction,
    });

    if (to_state === 'SIGNOFF' || to_state === 'COMPLETED') {
      await create_offline_waiting_datasets(run.dataValues, transaction);
    }
    await transaction.commit();
    await fill_dataset_triplet_cache();
    const saved_run = await Run.findByPk(run_number, {
      include: [
        {
          model: DatasetTripletCache,
          attributes: ['triplet_summary'],
        },
      ],
    });
    res.json(saved_run.dataValues);
  } catch (e) {
    console.log(e);
    await transaction.rollback();
    throw `Error SIGNING OFF run, creating the datasets from run in OFFLINE`;
  }
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
    if (key.startsWith('triplet_summary')) {
      delete new_filter[key];
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
    } else {
      new_filter[key] = val;
      contains_something = true;
    }
  }
  return [new_filter, contains_something];
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
    } else if (key.includes('-')) {
      key = sequelize.literal(
        `("DatasetTripletCache"."triplet_summary"#>>'{${key}}')`
      );
    }
    return [key, order];
  });
};

// Separate filtering and count will make the UX much faster.
exports.getRunsFilteredOrdered = async (req, res) => {
  // A user can filter on triplets, or on any other field
  // If the user filters by triplets, then :
  let [run_filter, run_filter_exists] = getRunFilter(req.body.filter, false);
  if (!run_filter_exists) {
    run_filter = {};
  }
  let [triplet_summary_filter, triplet_filter_exists] = getTripletSummaryFilter(
    req.body.filter,
    false
  );
  if (!triplet_filter_exists) {
    triplet_summary_filter = {};
  }
  triplet_summary_filter = changeNameOfAllKeys(
    triplet_summary_filter,
    conversion_operator
  );

  const { sortings, page_size, page } = req.body;
  const formated_sortings = formatSortings(sortings);
  let filter = {
    ...changeNameOfAllKeys(run_filter, conversion_operator),
    deleted: false,
  };
  let offset = page_size * page;
  let include = [
    {
      model: DatasetTripletCache,
      where: triplet_summary_filter,
      attributes: ['triplet_summary'],
    },
  ];
  // findAndCountAll is slower than doing separate count, and filtering
  const count = await Run.count({
    where: filter,
    include,
  });
  let pages = Math.ceil(count / page_size);
  let runs = await Run.findAll({
    where: filter,
    order:
      formated_sortings.length > 0
        ? formated_sortings
        : [['run_number', 'DESC']],
    limit: page_size,
    offset,
    include,
  });
  res.json({ runs, pages, count });
};

exports.getDatasetNamesOfRun = async (req, res) => {
  const { run_number } = req.params;
  const datasets = await Dataset.findAll({
    where: {
      run_number,
      deleted: false,
    },
  });
  const unique_dataset_names_object = {};
  datasets.forEach(({ name }) => {
    unique_dataset_names_object[name] = name;
  });
  const unique_dataset_names = Object.keys(unique_dataset_names_object);
  res.json(unique_dataset_names);
};
