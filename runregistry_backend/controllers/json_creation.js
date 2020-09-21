const changeNameOfAllKeys = require('change-name-of-all-keys');
const jsonLogicToSql = require('json-logic-to-sql-compiler');
const {
  get_rr_lumisections_for_dataset,
  get_oms_lumisections_for_dataset,
} = require('./lumisection');
const {
  calculate_dataset_filter_and_include,
} = require('../controllers/dataset');
const { sequelize, Sequelize } = require('../models');
const { Dataset, Run, DatasetTripletCache } = require('../models');

const delete_this_line = require('./queue_json_creation');
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

// Given a filter for datasets (and runs) it finds the datasets which match
exports.get_datasets_with_filter = async (dataset_filter, run_filter) => {
  const [final_filter, include] = calculate_dataset_filter_and_include(
    dataset_filter,
    run_filter
  );
  // We remove the attributes from Run and DatasetTripletCache (since we are only interested in the run_numbers):
  include[0].attributes = [];
  include[1].attributes = [];
  return await Dataset.findAll({
    attributes: ['Dataset.run_number', 'Dataset.name'],
    where: final_filter,
    order: ['run_number'],
    include,
    group: ['Dataset.run_number', 'Dataset.name'],
    raw: true,
  });
};

exports.calculate_number_of_lumisections_from_json = (json) => {
  let number_of_lumisections = 0;
  for (const [run, ranges] of Object.entries(json)) {
    for (const [range_start, range_end] of ranges) {
      const lumisections_in_range = range_end - range_start + 1;
      number_of_lumisections += lumisections_in_range;
    }
  }
  return number_of_lumisections;
};

exports.calculate_json_based_on_ranges = async (req, res) => {
  const sql = jsonLogicToSql(String(req.body.json_logic));
  const ranges_of_runs = await sequelize.query(sql, {
    type: sequelize.QueryTypes.SELECT,
  });

  const {
    final_json,
    dataset_in_run_in_json,
    final_json_with_dataset_names,
  } = exports.calculate_json_with_many_ranges(ranges_of_runs);
  res.json({
    final_json,
    dataset_in_run_in_json,
    final_json_with_dataset_names,
  });
};

exports.calculate_json_with_many_ranges = (ranges_of_runs) => {
  const final_json = {};
  const final_json_with_dataset_names = {};
  const dataset_in_run_in_json = {};
  ranges_of_runs.forEach((run) => {
    // It require run_number and name are the only 2 selection other than dcs_ranges and rr_ranges:
    const { run_number, name } = run;
    delete run.run_number;
    delete run.name;

    if (typeof dataset_in_run_in_json[run_number] !== 'undefined') {
      throw 'There exists mutliple datasets for that json logic filter. please include a filter that accepts only 1 dataset per run';
    }
    dataset_in_run_in_json[run_number] = name;

    let final_array = [];
    let array_emptied_already = false;
    for (let [column_name, ranges] of Object.entries(run)) {
      ranges = JSON.parse(ranges);
      if (!Array.isArray(ranges)) {
        throw `Range of ${column_name} in ${run_number}, ${name} is not an array`;
      }
      // If the array was empty once, it cannot be filled again with new ranges:
      if (!array_emptied_already) {
        final_array = recalculate_ranges_with_new_ranges(final_array, ranges);
      }
      if (final_array.length === 0) {
        array_emptied_already = true;
      }
    }
    if (final_array.length > 0) {
      final_json[run_number] = final_array;
      final_json_with_dataset_names[`${run_number}-${name}`] = final_array;
    }
  });
  return {
    final_json,
    dataset_in_run_in_json,
    final_json_with_dataset_names,
  };
};

const recalculate_ranges_with_new_ranges = (current_ranges, new_ranges) => {
  if (!Array.isArray(current_ranges) || !Array.isArray(new_ranges)) {
    throw `Ranges need to be arrays`;
  }
  if (current_ranges.length === 0) {
    return new_ranges;
  }

  const resulting_ranges = [];
  new_ranges.forEach((range) => {
    const [start_lumisection, end_lumisection] = range;

    current_ranges.forEach((old_range) => {
      const [start_lumisection_old, end_lumisection_old] = old_range;
      // If the new range is more specific, we stick with the new range:
      if (
        start_lumisection >= start_lumisection_old &&
        end_lumisection <= end_lumisection_old
      ) {
        // the new range is shorter, so we stick with the new range
        resulting_ranges.push(range);
      } else if (
        // If the new range contains the previous range
        start_lumisection <= start_lumisection_old &&
        end_lumisection >= end_lumisection_old
      ) {
        resulting_ranges.push(old_range);
      }
      // If there are some lumisections below (not included in current range) and then some above (included) with current range
      else if (
        start_lumisection <= start_lumisection_old &&
        end_lumisection >= start_lumisection_old
      ) {
        resulting_ranges.push([start_lumisection_old, end_lumisection]);
      }
      // If there are some lumisections in the current range and then some above, we stick with the stricter limit (the new lower limit) and the
      else if (
        start_lumisection <= end_lumisection_old &&
        end_lumisection >= end_lumisection_old
      ) {
        resulting_ranges.push([start_lumisection, end_lumisection_old]);
      }
    });
  });
  return resulting_ranges;
};

// Test case:
// const new = [[1,19], [21, 45]]
// const old = [[19,40]]
