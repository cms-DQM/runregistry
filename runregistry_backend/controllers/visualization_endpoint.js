// This tool is independent from the rest, it uses the endpoints through HTTP calls
const json_logic = require('json-logic-js');
const axios = require('axios');
const config = require('../config/config');
const {
  get_lumisections_not_in_golden_json_but_in_denominator,
} = require('golden-json-helpers');
const {
  return_classifier_evaluated_tuple,
} = require('./classifier_playground');
const { get_data_of_json } = require('./lumisection');

const { API_URL } = config[process.env.ENV || 'development'];

exports.get_visualization_endpoint = async (req, res) => {
  const { golden_logic, denominator_logic } = req.body;

  res.json({
    ...(await exports.get_visualization(golden_logic, denominator_logic)),
  });
};
exports.get_visualization = async (golden_logic, denominator_logic) => {
  //  We generate the jsons first:

  const {
    data: { final_json_with_dataset_names: golden_json },
  } = await axios.post(`${API_URL}/json_creation/generate`, {
    json_logic: golden_logic,
  });

  const {
    data: { final_json_with_dataset_names: denominator_json },
  } = await axios.post(`${API_URL}/json_creation/generate`, {
    json_logic: denominator_logic,
  });

  const anti_golden_json = get_lumisections_not_in_golden_json_but_in_denominator(
    golden_json,
    denominator_json
  );

  const { data: anti_json_data_and_luminosity } = await axios.post(
    `${API_URL}/lumisections/get_data_of_json`,
    {
      json: anti_golden_json,
    }
  );
  const {
    json_with_data: anti_golden_json_data,
    total_recorded_luminosity: recorded_luminosity_lost,
    total_delivered_luminosity: delivered_luminosity_lost,
  } = anti_json_data_and_luminosity;

  // const { data: golden_json_data_and_luminosity } = await axios.post(
  //   `${API_URL}/lumisections/get_data_of_json`,
  //   {
  //     json: golden_json
  //   }
  // );

  // const {
  //   total_recorded_luminosity: recorded_luminosity_in_golden,
  //   total_delivered_luminosity: delivered_luminosity_in_golden
  // } = golden_json_data_and_luminosity;

  // gather all combination of rules that are false from the golden json logic
  // create distribution of how popular are these rules
  const evaluated_json = exports.get_anti_json_evaluated(
    anti_golden_json_data,
    golden_logic
  );

  let {
    rules_flagged_false_quantity,
    rules_flagged_false_combination,
    rules_flagged_false_quantity_luminosity,
    rules_flagged_false_combination_luminosity,
  } = exports.get_all_combination_of_causes_flagged_false(
    evaluated_json,
    anti_golden_json_data
  );

  return {
    recorded_luminosity_lost,
    delivered_luminosity_lost,
    // recorded_luminosity_in_golden,
    // delivered_luminosity_in_golden,
    rules_flagged_false_quantity,
    rules_flagged_false_combination,
    rules_flagged_false_quantity_luminosity,
    rules_flagged_false_combination_luminosity,
  };
};

exports.get_all_combination_of_causes_flagged_false = (
  evaluated_json,
  anti_golden_json_data
) => {
  const rules_flagged_false_quantity = {};
  const rules_flagged_false_combination = {};
  const rules_flagged_false_quantity_luminosity = {};
  const rules_flagged_false_combination_luminosity = {};
  for (const [identifier, lumisections] of Object.entries(evaluated_json)) {
    for (const [ls_index, evaluated_lumisection] of Object.entries(
      lumisections
    )) {
      const rules_why_false = return_cause_of_false_flagging(
        evaluated_lumisection
      );
      const rules_why_false_reference = JSON.stringify(rules_why_false);
      const current_counter =
        rules_flagged_false_combination[rules_why_false_reference];

      let luminosity_of_lumisection = +anti_golden_json_data[identifier][
        ls_index
      ]['lumisection']['oms']['recorded'];

      if (luminosity_of_lumisection <= 0 || !luminosity_of_lumisection) {
        luminosity_of_lumisection = 0;
      } else {
        // We are only interested in the rules which had more than 0 of luminosity
        // Increment combination counter
        if (typeof current_counter === 'undefined') {
          rules_flagged_false_combination[rules_why_false_reference] = 1;
          rules_flagged_false_combination_luminosity[
            rules_why_false_reference
          ] = luminosity_of_lumisection;
        } else {
          rules_flagged_false_combination[rules_why_false_reference] += 1;
          rules_flagged_false_combination_luminosity[
            rules_why_false_reference
          ] += luminosity_of_lumisection;
        }

        // Increment individual counter
        rules_why_false.forEach((rule) => {
          const rule_stringified = JSON.stringify(rule);
          const current_counter_quantity =
            rules_flagged_false_quantity[rule_stringified];
          if (typeof current_counter_quantity === 'undefined') {
            rules_flagged_false_quantity[rule_stringified] = 1;
            rules_flagged_false_quantity_luminosity[
              rule_stringified
            ] = luminosity_of_lumisection;
          } else {
            rules_flagged_false_quantity[rule_stringified] += 1;
            rules_flagged_false_quantity_luminosity[
              rule_stringified
            ] += luminosity_of_lumisection;
          }
        });
      }
    }
  }

  return {
    rules_flagged_false_quantity,
    rules_flagged_false_combination,
    rules_flagged_false_quantity_luminosity,
    rules_flagged_false_combination_luminosity,
  };
};

const return_cause_of_false_flagging = (evaluated_lumisection) => {
  let current_flagged_bad_rules = [];
  const final_value = evaluated_lumisection[evaluated_lumisection.length - 1];
  if (final_value.hasOwnProperty('resulted_value')) {
    if (final_value.resulted_value === false) {
      if (
        evaluated_lumisection[0].hasOwnProperty('and') ||
        evaluated_lumisection[0].hasOwnProperty('or')
      ) {
        const children =
          evaluated_lumisection[0][Object.keys(evaluated_lumisection[0])];
        children.forEach((child_rule) => {
          const children_flagged_bad_rules = return_cause_of_false_flagging(
            child_rule
          );
          current_flagged_bad_rules = [
            ...current_flagged_bad_rules,
            ...children_flagged_bad_rules,
          ];
        });
      } else {
        // we are in a leaf of the tree, no more children
        current_flagged_bad_rules = [
          ...current_flagged_bad_rules,
          evaluated_lumisection[0],
        ];
      }
    }
  }
  return current_flagged_bad_rules;
};

exports.get_anti_json_evaluated = (anti_golden_json_data, golden_logic) => {
  if (typeof golden_logic === 'string') {
    golden_logic = JSON.parse(golden_logic);
  }
  Object.freeze(golden_logic);
  const evaluated_json = {};
  for (const [identifier, lumisections] of Object.entries(
    anti_golden_json_data
  )) {
    for (const [lumisection_number, lumisection_data] of Object.entries(
      lumisections
    )) {
      const golden_logic_copy = JSON.parse(JSON.stringify(golden_logic));
      const [evaluated_lumisection] = return_classifier_evaluated_tuple(
        lumisection_data,
        golden_logic_copy
      );
      if (typeof evaluated_json[identifier] === 'undefined') {
        evaluated_json[identifier] = {
          [lumisection_number]: evaluated_lumisection,
        };
      } else {
        evaluated_json[identifier][lumisection_number] = evaluated_lumisection;
      }
    }
  }
  return evaluated_json;
};
