const sequelize = require('../models').sequelize;
const Cycle = require('../models').Cycle;
const CycleDataset = require('../models').CycleDataset;
const Dataset = require('../models').Dataset;
const Sequelize = require('../models').Sequelize;
const { default: PQueue } = require('p-queue');
const { create_new_version } = require('./version');
const { moveDataset, update_or_create_dataset } = require('./dataset');
const { calculate_dataset_filter_and_include } = require('./dataset');

exports.getOneInternal = async (id_cycle) => {
  let cycle = await Cycle.findByPk(id_cycle, {
    include: [
      {
        model: CycleDataset,
        include: [{ model: Dataset }],
      },
    ],
    where: {
      deleted: false,
    },
  });
  if (cycle === null) {
    throw `Cycle ${id_cycle} does not exist`;
  }
  let datasets = [];
  cycle.dataValues.CycleDataset.forEach(({ Datasets }) => {
    datasets = [...datasets, ...Datasets];
  });
  cycle.datasets = datasets;
  return cycle;
};

exports.add = async (req, res) => {
  const { cycle_attributes, cycle_name, deadline, filter } = req.body;
  if (Object.keys(cycle_attributes).length === 0) {
    throw `There must be at least 1 workspace selected`;
  }
  if (!Object.keys(cycle_attributes).includes('global_state')) {
    throw `Cycle must include global workspace state`;
  }
  if (!cycle_name) {
    throw `Please add a cycle name (must be unique)`;
  }
  if (!deadline) {
    throw `Please add cycle deadline`;
  }
  let transaction;
  try {
    transaction = await sequelize.transaction();

    const cycle = await Cycle.create(
      {
        cycle_attributes: cycle_attributes,
        cycle_name,
        deadline,
        deleted: false,
      },
      { transaction }
    );
    const { id_cycle } = cycle;
    // A filter comes, and we must reproduce that filter to get the dataset that were displayed on the lower table to add them to the cycle
    const [calculated_filter, include] = calculate_dataset_filter_and_include(
      filter
    );

    const selected_datasets = await Dataset.findAll({
      where: calculated_filter,
      include,
    });
    if (selected_datasets.length === 0) {
      throw `No dataset found for filter criteria, select at least 1 dataset`;
    }
    if (selected_datasets.length > 1000) {
      throw `Too much datasets for cycle, maximum is 1000`;
    }

    const datasets_promises = selected_datasets.map(
      async ({ run_number, name }) => {
        if (!run_number || !name) {
          throw 'run_number and name of the dataset must be valid';
        }
        if (name === 'online') {
          throw 'Online dataset cannot be part of a cycle';
        }
        const cycle_datasets = await CycleDataset.create(
          {
            id_cycle,
            run_number,
            name,
          },
          { transaction }
        );
      }
    );
    await Promise.all(datasets_promises);
    await transaction.commit();
    const saved_cycle = await exports.getOneInternal(id_cycle);
    res.json(saved_cycle);
  } catch (err) {
    console.log(err);
    await transaction.rollback();
    throw `Error creating cycle: ${err}`;
  }
};
exports.getAll = async (req, res) => {
  const { workspace } = req.params;
  const workspace_state = `cycle_attributes.${workspace}_state`;
  let cycles = await Cycle.findAll({
    include: [
      {
        model: CycleDataset,
        include: [{ model: Dataset }],
      },
    ],
    where: {
      deleted: false,
    },
    order: [
      [sequelize.json(`cycle_attributes.${workspace_state}`), 'desc'],
      ['deadline', 'asc'],
    ],
  });
  // To add the datasets property to each cycle:
  cycles = cycles.map(({ dataValues }) => {
    const { CycleDataset } = dataValues;
    let datasets = [];
    CycleDataset.forEach(({ Datasets }) => {
      datasets = [...datasets, ...Datasets];
    });
    return {
      ...dataValues,
      datasets,
    };
  });
  res.json(cycles);
};

exports.getOne = async (req, res) => {
  const cycle = await exports.getOneInternal(req.body.id_cycle);
  res.json(cycle);
};

exports.delete = async (req, res) => {
  const { id_cycle } = req.body;
  const cycle_to_delete = await Cycle.findByPk(id_cycle);
  if (cycle_to_delete.deleted) {
    throw 'Cycle already deleted';
  }
  const updated_cycle = await cycle_to_delete.update({ deleted: true });
  res.json(updated_cycle);
};

exports.editCycleInformation = async (req, res) => {
  const { id_cycle, deadline, cycle_attributes, cycle_name } = req.body;
  const existing_cycle = await exports.getOneInternal(id_cycle);
  if (existing_cycle === null) {
    throw `Cycle ${id_cycle} does not exist`;
  }
  if (Object.keys(cycle_attributes).length === 0) {
    throw `There must be at least 1 workspace selected`;
  }
  if (!Object.keys(cycle_attributes).includes('global_state')) {
    throw `Cycle must include global workspace state`;
  }
  if (!cycle_name) {
    throw `Please add a cycle name (must be unique)`;
  }
  if (!deadline) {
    throw `Please add cycle deadline`;
  }
  await existing_cycle.update({
    cycle_attributes: cycle_attributes,
    cycle_name,
    deadline,
  });
  const saved_cycle = await exports.getOneInternal(id_cycle);
  res.json(saved_cycle);
};

exports.addDatasetsToCycle = async (req, res) => {
  const { id_cycle, filter } = req.body;

  // Validate the cycle exists:
  const cycle = await exports.getOneInternal(id_cycle);

  const [calculated_filter, include] = calculate_dataset_filter_and_include(
    filter
  );
  const datasets_to_add = await Dataset.findAll({
    where: calculated_filter,
    include,
  });

  if (datasets_to_add.length === 0) {
    throw `No dataset found for filter criteria, select at least 1 dataset`;
  }
  if (datasets_to_add.length > 1000) {
    throw `Too much datasets for cycle, maximum is 1000`;
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();
    const datasets_promises = datasets_to_add.map(
      async ({ run_number, name }) => {
        if (!run_number || !name) {
          throw 'run_number and name of the dataset must be valid';
        }
        if (name === 'online') {
          throw 'Online dataset cannot be part of a cycle';
        }
        const cycle_datasets = await CycleDataset.create(
          {
            id_cycle,
            run_number,
            name,
          },
          { transaction }
        );
      }
    );
    const results = await Promise.allSettled(datasets_promises);
    await transaction.commit();
    const cycle = await exports.getOneInternal(id_cycle);
    res.json(cycle);
  } catch (err) {
    console.log(err);
    await transaction.rollback();
    throw `Error adding runs to cycle: ${err}`;
  }
};

exports.deleteDatasetsFromCycle = async (req, res) => {
  const { id_cycle, filter } = req.body;

  const cycle = await exports.getOneInternal(id_cycle);

  const [calculated_filter, include] = calculate_dataset_filter_and_include(
    filter
  );
  const datasets_to_delete_from_cycle = await Dataset.findAll({
    where: calculated_filter,
    include,
  });

  if (datasets_to_delete_from_cycle.length === 0) {
    throw `No dataset found for filter criteria, select at least 1 dataset`;
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();
    const datasets_promises = datasets_to_delete_from_cycle.map(
      async ({ run_number, name }) => {
        const dataset_to_delete_from_cycle = cycle.datasets.find(
          (dataset) =>
            dataset.run_number === run_number && dataset.name === name
        );
        if (typeof dataset_to_delete_from_cycle === 'undefined') {
          throw `Dataset ${run_number}, ${name} is not in the Cycle's datasets, please make sure the datasets you are deleting from the cycle are in the cycle.`;
        }
        await CycleDataset.destroy({
          where: {
            id_cycle,
            run_number,
            name,
          },
          transaction,
        });
      }
    );
    await Promise.all(datasets_promises);
    await transaction.commit();
    const cycle = await exports.getOneInternal(id_cycle);
    res.json(cycle);
  } catch (err) {
    console.log(err);
    await transaction.rollback();
    throw `Error deleting runs from cycle: ${err}`;
  }
};

exports.moveAllDatasetsInCycleTo = async (req, res) => {
  const { workspace } = req.params;
  const { id_cycle, to_state } = req.body;
  const cycle = await exports.getOneInternal(id_cycle);

  const { cycle_attributes, datasets } = cycle;
  // Check wether cycle is still open:
  const cycle_state_in_workspace = cycle_attributes[`${workspace}_state`];
  if (cycle_state_in_workspace === 'completed') {
    throw `This cycle is already marked COMPLETED`;
  }

  // Check wether all datasets are already in COMPLETED state, if so, error out
  const datasets_to_move = datasets.filter((dataset) => {
    const dataset_state_in_workspace =
      dataset.dataset_attributes[`${workspace}_state`];
    return (
      typeof dataset_state_in_workspace !== 'undefined' &&
      dataset_state_in_workspace !== 'COMPLETED'
    );
  });

  if (datasets_to_move.length === 0) {
    throw `All the datasets in this cycle in workspace ${workspace}, have already been moved to COMPLETED OR no dataset is in this workspace in this cycle`;
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { atomic_version } = await create_new_version({
      req,
      comment: `Change all datasets in cycle ${id_cycle} to ${to_state}.`,
    });

    const promises = datasets_to_move.map(
      ({ run_number, name, dataset_attributes }) => async () => {
        await update_or_create_dataset({
          dataset_name: name,
          run_number,
          dataset_metadata: {
            [`${workspace}_state`]: to_state,
          },
          atomic_version,
          transaction,
        });
      }
    );

    const queue = new PQueue({ concurrency: 2 });
    await queue.addAll(promises);
    await transaction.commit();
    const updated_cycle = await exports.getOneInternal(id_cycle);
    res.json(updated_cycle);
  } catch (err) {
    console.log(err);
    await transaction.rollback();
    throw `Error moving all datasets in cycle ${id_cycle} to completed. Error: ${err}`;
  }
};

exports.moveCycleBackToPending = async (req, res) => {
  const { workspace } = req.params;
  const { id_cycle } = req.body;
  const cycle = await exports.getOneInternal(id_cycle);
  const { cycle_attributes } = cycle;
  // A cycle cannnot be moved back to PENDING unless it is PENDING in the global workspace first.
  if (
    workspace !== 'global' &&
    cycle_attributes['global_state'] === 'completed'
  ) {
    throw `Cycle with id ${id_cycle} can't be moved back to PENDING since it is marked completed in global workspace. Ask DC Expert to move cycle back to PENDING in global workspace and then proceed`;
  }
  cycle.cycle_attributes = {
    ...cycle.cycle_attributes,
    [`${workspace}_state`]: 'pending',
  };
  const saved_cycle = await cycle.update({
    cycle_attributes: cycle.cycle_attributes,
  });

  res.json(saved_cycle);
};

exports.markCycleCompletedInWorkspace = async (req, res) => {
  const { workspace } = req.params;
  const { id_cycle } = req.body;
  const cycle = await exports.getOneInternal(id_cycle);

  // If cycle is global, it shall be completed in all other workspaces before being marked complete in global:
  const states_still_open = [];
  if (workspace === 'global') {
    for (const [key, state] of Object.entries(cycle.cycle_attributes)) {
      if (key !== 'global_state' && key.includes('_state')) {
        if (state !== 'completed') {
          states_still_open.push(key.split('_state')[0]);
        }
      }
    }
  }
  if (states_still_open.length > 0) {
    throw `You cannot mark this cycle as completed in the GLOBAL workspace, as it has not yet been moved to completed in ${states_still_open.join(
      ', '
    )} workspace(s)`;
  }

  // Validate if all datasets inside are moved to complete:
  const datasets_not_completed = [];
  cycle.datasets.forEach((dataset) => {
    if (
      typeof dataset.dataset_attributes[`${workspace}_state`] !== 'undefined' &&
      dataset.dataset_attributes[`${workspace}_state`] !== 'COMPLETED'
    ) {
      datasets_not_completed.push(dataset);
    }
  });
  if (datasets_not_completed.length > 0) {
    throw `This cycle contains ${
      datasets_not_completed.length
    } dataset(s) which have not been moved to completed. <br/><br/>They are:<br/>${datasets_not_completed
      .map(({ run_number, name }) => `<p>${run_number} - ${name}</p>`)
      .join('')}`;
  }

  cycle.cycle_attributes = {
    ...cycle.cycle_attributes,
    [`${workspace}_state`]: 'completed',
  };
  const saved_cycle = await cycle.update({
    cycle_attributes: cycle.cycle_attributes,
  });
  res.json(saved_cycle);
};

exports.moveDataset = async (req, res) => {
  const { workspace } = req.params;
  const { id_cycle, run_number, dataset_name } = req.body;
  const cycle = await exports.getOneInternal(id_cycle);
  const exists = cycle.datasets.some(
    (dataset) =>
      dataset.run_number === run_number && dataset.name === dataset_name
  );
  if (!exists) {
    throw `Dataset ${run_number}-${datase_name} does not belong to cycle ${id_cycle}`;
  }
  if (cycle === null) {
    throw `Cycle does not exist`;
  }
  if (typeof cycle.cycle_attributes[`${workspace}_state`] === 'undefined') {
    throw `Cycle does not exist in workspace ${workspace}`;
  }
  if (cycle.cycle_attributes[`${workspace}_state`] === 'completed') {
    throw `This cycle has already been marked COMPLETED, therefore you cannot change the state of the dataset unless you change the state of the cycle`;
  }
  // Now after validation, actually move the state:
  moveDataset(req, res);
};
