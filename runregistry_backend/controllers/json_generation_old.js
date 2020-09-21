const {
  get_rr_lumisections_for_dataset,
  get_oms_lumisections_for_dataset
} = require('./lumisection');
const sequelize = require('../models').sequelize;
const { Dataset, Run } = require('../models');

// We need to go from [1,2,3,4,10,11,12] to [[1,4], [10,12]]:
const convert_array_of_list_to_array_of_ranges = list_of_good_lumisections => {
  const array_of_ranges = [];
  list_of_good_lumisections.forEach((lumisection_number, index) => {
    if (array_of_ranges.length === 0) {
      array_of_ranges.push([lumisection_number, lumisection_number]);
    }
    // If we are not in the end of the array:
    if (index !== list_of_good_lumisections.length - 1) {
      // If the next lumisection is equal to the current lumisection +1 (they both belong to the same range)
      if (list_of_good_lumisections[index + 1] === lumisection_number + 1) {
        array_of_ranges[array_of_ranges.length - 1][1] = lumisection_number + 1;
      } else {
        // If not, we are at the end of the current range, therefore we need to insert a new range, starting from the next lumisection in the array which is +1 the current position:
        array_of_ranges.push([
          list_of_good_lumisections[index + 1],
          list_of_good_lumisections[index + 1]
        ]);
      }
    }
  });
  return array_of_ranges;
};

exports.get_all_distinct_run_numbers_for_dataset = async dataset_name => {
  let run_numbers = await sequelize.query(
    `
        SELECT distinct run_number from "Dataset" where "Dataset".name = :dataset_name`,
    {
      type: sequelize.QueryTypes.SELECT,
      replacements: {
        dataset_name
      }
    }
  );
  run_numbers = run_numbers.map(({ run_number }) => run_number);
  return run_numbers;
};

exports.generate_golden_json_for_dataset = async (
  run_number,
  dataset_name,
  rr_columns_required_to_be_good,
  oms_columns_required_to_be_good
) => {
  // rr_columns_required_to_be_good must be: ['dt-dt', 'csc-csc','tracker-pix','tracker-strip']
  if (
    !rr_columns_required_to_be_good ||
    rr_columns_required_to_be_good.length === 0
  ) {
    throw 'There must be a non empty array of columns to compare';
  }

  const dataset = await Dataset.findOne({
    where: {
      name: dataset_name,
      run_number
    },
    include: [
      {
        model: Run
      }
    ]
  });
  if (dataset.Run.oms_attributes.recorded_lumi <= 0.08) {
    return [];
  }
  if (dataset === null) {
    throw `Dataset: ${dataset_name} of run ${run_number} does not exist`;
  }
  const rr_lumisections = await get_rr_lumisections_for_dataset(
    run_number,
    dataset_name
  );
  // The only dataset that is referenced in OMS is the run, therefore it is the online dataset
  const oms_lumisections = await get_oms_lumisections_for_dataset(
    run_number,
    dataset_name
  );
  if (rr_lumisections.length !== oms_lumisections.length) {
    throw `OMS lumisections and RR lumisections do not match for dataset ${dataset_name}, run: ${run_number}, please reset the run's lumisections, in worst case delete datasets and signoff run again`;
  }
  const good_lumisections = [];
  rr_lumisections.forEach((rr_lumisection, index) => {
    const lumisection_number = index + 1;
    let lumisection_overall_status = true;
    rr_columns_required_to_be_good.forEach(duplet => {
      const column = duplet[0];
      const desired_value = duplet[1];
      if (!rr_lumisection[column]) {
        throw `There is no ${column} value for lumisection #${lumisection_number} of dataset ${dataset_name} of run ${run_number}`;
      }
      const { status } = rr_lumisection[column];
      if (!status) {
        lumisection_overall_status = false;
      } else if (status !== desired_value) {
        lumisection_overall_status = false;
      }
    });
    const oms_lumisection = oms_lumisections[index];
    oms_columns_required_to_be_good.forEach(duplet => {
      const column = duplet[0];
      const desired_value = duplet[1];
      if (typeof oms_lumisection[column] === 'undefined') {
        throw `There is no ${column} value for lumisection #${lumisection_number} of dataset ${dataset_name} of run ${run_number}`;
      }
      if (oms_lumisection[column] !== desired_value) {
        lumisection_overall_status = false;
      }
    });

    if (lumisection_overall_status) {
      // If it is still true, it means it was true for all
      // index is 0-based, but lumisection indexing starts at 1, so we add 1:
      good_lumisections.push(index + 1);
    }
  });
  return convert_array_of_list_to_array_of_ranges(good_lumisections);
};
