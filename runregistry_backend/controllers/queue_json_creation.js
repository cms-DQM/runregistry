const json_logic_library = require('json-logic-js');
const axios = require('axios');
const config = require('../config/config');
const { API_URL, REDIS_URL } = config[process.env.ENV || 'development'];
const {
  convert_array_of_list_to_array_of_ranges,
} = require('golden-json-helpers');
const { http } = require('http');
const {
  return_classifier_evaluated_tuple,
} = require('./classifier_playground');
const io = require('socket.io')(http);
const {
  sequelize,
  Sequelize,
  GeneratedJson,
  Version,
  AggregatedLumisection,
  DatasetTripletCache,
} = require('../models');
const { format_lumisection } = require('./lumisection');
const pMap = require('p-map');
const Queue = require('bull');
const { Op } = Sequelize;

let jsonProcessingQueue = new Queue('rr_jsons', REDIS_URL);
console.log(`queue_json_creation.js : ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);

exports.get_json = async (req, res) => {
  const { id_json } = req.body;
  const saved_json = await GeneratedJson.findOne({
    where: {
      id: id_json,
    },
  });
  if (saved_json) {
    res.json({ final_json: saved_json });
  } else {
    const json = await jsonProcessingQueue.getJob(id_json);
    if (await json.isWaiting()) {
      // 203 for queued
      res.status(203);
      res.send();
    } else if ((await json.isFailed()) || (await json.isStuck())) {
      res.status(500);
      res.send();
    } else {
      // 202 for still processing:
      res.status(202).json({ progress: (await json.progress()) || 0 });
    }
  }
};

exports.get_jsons = async (req, res) => {
  const { filter, reference } = req.body;

  const { email } = req.headers;
  let failed = [],
    waiting = [],
    active = [];

  try {
    failed = await jsonProcessingQueue.getFailed();
    waiting = await jsonProcessingQueue.getWaiting();
    active = await jsonProcessingQueue.getActive();
  } catch (err) {
    console.log('queue_json_creation.js # get_json(): ', err);
  }
  const reference_filter = {};
  if (typeof reference !== 'undefined') {
    failed = [];
    waiting = [];
    active = [];
    reference_filter['id'] = {
      [Op.lt]: reference,
    };
  }
  let saved_jsons = [];
  if (filter === 'by_email') {
    saved_jsons = await GeneratedJson.findAll({
      where: {
        deleted: false,
        created_by: email,
        ...reference_filter,
      },
      order: [['id', 'DESC']],
      limit: 10,
    });
  }
  if (filter === 'official') {
    saved_jsons = await GeneratedJson.findAll({
      where: {
        deleted: false,
        official: true,
        ...reference_filter,
      },
      order: [['id', 'DESC']],
      limit: 10,
    });
  }
  if (filter === 'all') {
    saved_jsons = await GeneratedJson.findAll({
      where: {
        deleted: false,
        ...reference_filter,
      },
      order: [['id', 'DESC']],
      limit: 10,
    });
  }

  let jsons = [
    ...failed.map(({ id, data, failedReason }) => ({
      ...data,
      id,
      failedReason,
      progress: 0,
      active: false,
      waiting: false,
      failed: true,
    })),
    ...waiting.map(({ id, _progress, data }) => ({
      ...data,
      id,
      progress: _progress,
      active: false,
      waiting: true,
      failed: false,
    })),
    ...active.map(({ id, _progress, data }) => ({
      ...data,
      id,
      progress: _progress,
      active: true,
      waiting: false,
      failed: false,
    })),
    ...saved_jsons.map(({ dataValues }) => ({
      ...dataValues,
      progress: 1,
      active: false,
      waiting: false,
      failed: false,
    })),
  ];
  if (filter === 'by_email') {
    jsons = jsons.filter(({ created_by }) => created_by === email);
  }
  if (filter === 'official') {
    jsons = jsons.filter(({ official }) => official);
  }
  res.json({ jsons: jsons });
};

exports.delete_json = async (req, res) => {
  const { id_json } = req.body;
  const egroups = req.get('egroups');
  const email = req.get('email');

  const to_delete = await GeneratedJson.findOne({
    where: {
      id: id_json,
    },
  });
  if (!to_delete) {
    throw `JSON with id ${id_json} to delete not found`;
  }
  if (
    email !== to_delete.created_by &&
    !egroups.includes('cms-dqm-runregistry-experts')
  ) {
    throw `To edit this classifier you must be the  creator (${to_delete.created_by}) or be part of cms-dqm-runregistry-experts e-group`;
  }

  const deleted_json = await to_delete.update({
    deleted: true,
  });
  res.json({ deleted_json });
};

exports.calculate_json = async (req, res) => {
  const { json_logic, dataset_name_filter, tags, official } = req.body;
  const created_by = req.get('email');
  let parsed_json;
  try {
    parsed_json = JSON.parse(json_logic);
  } catch (err) {
    throw `JSON logic sent is not in json format`;
  }
  if (!parsed_json || Object.keys(parsed_json).length === 0) {
    throw 'Empty json logic sent';
  }
  if (!dataset_name_filter) {
    throw 'No dataset name specified';
  }
  const datasets = await sequelize.query(
    `
      SELECT name FROM "Dataset"
      WHERE name SIMILAR TO :name
      AND deleted = false
    `,
    {
      type: sequelize.QueryTypes.SELECT,
      replacements: {
        name: dataset_name_filter,
      },
    }
  );
  if (datasets.length === 0) {
    throw 'No datasets matched that dataset name';
  }

  // We select the sequence from the table:
  const [{ nextval }] = await sequelize.query(
    `SELECT nextval('"GeneratedJson_id_seq"')`,
    {
      type: sequelize.QueryTypes.SELECT,
    }
  );

  const json = await jsonProcessingQueue.add(
    {
      dataset_name_filter,
      json_logic: parsed_json,
      created_by,
      tags: tags || '',
      official: official || false,
    },
    { jobId: +nextval, attempts: 5 }
  );
  jsonProcessingQueue.on('progress', (job, progress) => {
    req.io.emit('progress', { id: job.id, progress });
  });

  jsonProcessingQueue.on('completed', (job, result) => {
    req.io.emit('completed', { id: job.id, result });
    console.log(`queue_json_creation.js # calculate_json(): completed job ${job.id}: `);
  });
  req.io.emit('new_json_added_to_queue', { id: json.id, job: json });
  res.json(json);
};

// TODO-ENHANCEMENT: Add information about job: started at, finished at
if (process.env.ENV !== 'development' && process.env.ENV !== 'dev_to_prod') {
  jsonProcessingQueue.process(async (job, done) => {
    try {
      console.log('queue_json_creation.js # started processing job', job.id);
      const { dataset_name_filter, json_logic } = job.data;
      const datasets = await sequelize.query(
        `
      SELECT * FROM "Dataset"
      WHERE name SIMILAR TO :name
      AND deleted = false
      ORDER BY run_number ASC
    `,
        {
          type: sequelize.QueryTypes.SELECT,
          replacements: {
            name: dataset_name_filter,
          },
        }
      );
      const number_of_datasets = datasets.length;
      const generated_json_list = {};
      const generated_json_with_dataset_names_list = {};
      const generated_anti_json_list = {};
      const generated_anti_json_with_dataset_names_list = {};
      let counter_datasets_processed = 0;
      let total_recorded_luminosity = 0;
      let total_delivered_luminosity = 0;
      let recorded_luminosity_in_json = 0;
      let delivered_luminosity_in_json = 0;
      const min_run_number = datasets[0].run_number;
      const max_run_number = datasets[datasets.length - 1].run_number;
      const mapper = async (dataset) => {
        const { run_number, name: dataset_name_filter } = dataset;
        const lumisections = await AggregatedLumisection.findAll({
          where: {
            run_number,
            name: dataset_name_filter,
          },
        });

        for (let i = 0; i < lumisections.length; i++) {
          const lumisection = format_lumisection(lumisections[i]);
          const { run_number } = lumisection.run;
          const { name } = lumisection.dataset;
          const {
            lumisection_number,
            oms: oms_lumisection,
          } = lumisection.lumisection;
          const recorded = +oms_lumisection.recorded || 0;
          const delivered = +oms_lumisection.delivered || 0;
          const recorded_non_negative = recorded >= 0 ? recorded : 0;
          const delivered_non_negative = delivered >= 0 ? delivered : 0;

          // Add luminosity to all lumisections (good and bad):
          total_recorded_luminosity += recorded_non_negative;
          total_delivered_luminosity += delivered_non_negative;

          if (json_logic_library.apply(json_logic, lumisection)) {
            // Add luminosity to lumisections which made it in the golden json:
            recorded_luminosity_in_json += recorded_non_negative;
            delivered_luminosity_in_json += delivered_non_negative;
            // Add to json:
            if (typeof generated_json_list[run_number] === 'undefined') {
              generated_json_list[run_number] = [lumisection_number];
            } else {
              generated_json_list[run_number].push(lumisection_number);
            }
            if (
              typeof generated_json_with_dataset_names_list[
              `${run_number}-${name}`
              ] === 'undefined'
            ) {
              generated_json_with_dataset_names_list[
                `${run_number}-${name}`
              ] = [lumisection_number];
            } else {
              generated_json_with_dataset_names_list[
                `${run_number}-${name}`
              ].push(lumisection_number);
            }
          } else {
            // Belongs to the anti-json since it didn't pass criteriea for json logic:

            if (typeof generated_anti_json_list[run_number] === 'undefined') {
              generated_anti_json_list[run_number] = [lumisection_number];
            } else {
              generated_anti_json_list[run_number].push(lumisection_number);
            }
            if (
              typeof generated_anti_json_with_dataset_names_list[
              `${run_number}-${name}`
              ] === 'undefined'
            ) {
              generated_anti_json_with_dataset_names_list[
                `${run_number}-${name}`
              ] = [lumisection_number];
            } else {
              generated_anti_json_with_dataset_names_list[
                `${run_number}-${name}`
              ].push(lumisection_number);
            }
          }
        }
        counter_datasets_processed += 1;
        // We reserve the last 1% for the last bit
        job.progress((counter_datasets_processed - 1) / number_of_datasets);
      };

      await pMap(datasets, mapper, {
        concurrency: 4,
      });

      const generated_json = {};
      const generated_json_with_dataset_names = {};

      for (const [key, val] of Object.entries(generated_json_list)) {
        generated_json[key] = convert_array_of_list_to_array_of_ranges(val);
      }

      for (const [key, val] of Object.entries(
        generated_json_with_dataset_names_list
      )) {
        generated_json_with_dataset_names[
          key
        ] = convert_array_of_list_to_array_of_ranges(val);
      }

      // Obtain latest RR version
      const runregistry_version = await Version.max('atomic_version');

      // Add to database:
      const { created_by, tags, official } = job.data;
      // We first save the json, and then we calculate statistics:
      const saved_json = await GeneratedJson.create({
        id: job.id,
        dataset_name_filter: dataset_name_filter,
        tags,
        created_by,
        official,
        runregistry_version,
        json_logic,
        generated_json,
        generated_json_with_dataset_names,
        min_run_number,
        max_run_number,
        generated_anti_json: {},
        generated_anti_json_with_dataset_names: {},
        total_recorded_luminosity,
        total_delivered_luminosity,
        recorded_luminosity_in_json,
        delivered_luminosity_in_json,
        total_recorded_luminosity_lost: -1,
        total_delivered_luminosity_lost: -1,
        total_recorded_luminosity_from_run_range: -1,
        total_delivered_luminosity_from_run_range: -1,
        rules_flagged_false_quantity_luminosity: {},
        rules_flagged_false_combination_luminosity: {},
        runs_lumisections_responsible_for_rule: {},
        deleted: false,
      });

      // Finished:
      job.progress(1);

      // Get Visualization:
      const generated_anti_json = {};
      const generated_anti_json_with_dataset_names = {};

      for (const [key, val] of Object.entries(generated_anti_json_list)) {
        generated_anti_json[key] = convert_array_of_list_to_array_of_ranges(
          val
        );
      }

      for (const [key, val] of Object.entries(
        generated_anti_json_with_dataset_names_list
      )) {
        generated_anti_json_with_dataset_names[
          key
        ] = convert_array_of_list_to_array_of_ranges(val);
      }

      const { data: anti_json_data_and_luminosity } = await axios.post(
        `${API_URL}/lumisections/get_data_of_json`,
        {
          json: generated_anti_json_with_dataset_names,
        }
      );

      const {
        json_with_data: anti_golden_json_data,
        total_recorded_luminosity: total_recorded_luminosity_lost,
        total_delivered_luminosity: total_delivered_luminosity_lost,
      } = anti_json_data_and_luminosity;

      const evaluated_json = exports.get_anti_json_evaluated(
        anti_golden_json_data,
        json_logic
      );

      let {
        rules_flagged_false_quantity_luminosity,
        rules_flagged_false_combination_luminosity,
        runs_lumisections_responsible_for_rule,
      } = exports.get_all_combination_of_causes_flagged_false(
        evaluated_json,
        anti_golden_json_data
      );

      // Get whole luminosity for whole run range:
      const {
        brilcalc_recorded_luminosity: total_recorded_luminosity_from_run_range,
        brilcalc_delivered_luminosity: total_delivered_luminosity_from_run_range,
      } = await get_online_luminosity_from_run_range(
        min_run_number,
        max_run_number
      );

      await saved_json.update({
        generated_anti_json,
        generated_anti_json_with_dataset_names,
        total_recorded_luminosity_lost,
        total_delivered_luminosity_lost,
        rules_flagged_false_quantity_luminosity,
        rules_flagged_false_combination_luminosity,
        runs_lumisections_responsible_for_rule,
        total_recorded_luminosity_from_run_range,
        total_delivered_luminosity_from_run_range,
      });

      done(null, {
        generated_json,
        generated_json_with_dataset_names,
      });
    } catch (err) {
      console.log("queue_json_creation.js # ", err);
      done(err);
    }
  });

  const get_online_luminosity_from_run_range = async (run_min, run_max) => {
    const [luminosity_of_run_range] = await DatasetTripletCache.findAll({
      attributes: [
        [
          sequelize.fn('sum', sequelize.col('brilcalc_recorded_luminosity')),
          'brilcalc_recorded_luminosity',
        ],
        [
          sequelize.fn('sum', sequelize.col('brilcalc_delivered_luminosity')),
          'brilcalc_delivered_luminosity',
        ],
      ],
      where: {
        // We get the luminosity from the online dataset, since this contains absolutely all short runs, even commissioning, all that didn't make it to offline
        name: 'online',
        run_number: {
          [Op.gte]: run_min,
          [Op.lte]: run_max,
        },
      },
      raw: true,
    });

    return luminosity_of_run_range;
  };

  exports.get_anti_json_evaluated = (anti_golden_json_data, json_logic) => {
    if (typeof json_logic === 'string') {
      json_logic = JSON.parse(json_logic);
    }
    Object.freeze(json_logic);
    const evaluated_json = {};
    for (const [identifier, lumisections] of Object.entries(
      anti_golden_json_data
    )) {
      for (const [lumisection_number, lumisection_data] of Object.entries(
        lumisections
      )) {
        const json_logic_copy = JSON.parse(JSON.stringify(json_logic));
        const [evaluated_lumisection] = return_classifier_evaluated_tuple(
          lumisection_data,
          json_logic_copy
        );
        if (typeof evaluated_json[identifier] === 'undefined') {
          evaluated_json[identifier] = {
            [lumisection_number]: evaluated_lumisection,
          };
        } else {
          evaluated_json[identifier][
            lumisection_number
          ] = evaluated_lumisection;
        }
      }
    }
    return evaluated_json;
  };

  exports.get_all_combination_of_causes_flagged_false = (
    evaluated_json,
    anti_golden_json_data
  ) => {
    const rules_flagged_false_quantity = {};
    const rules_flagged_false_combination = {};
    const rules_flagged_false_quantity_luminosity = {};
    const rules_flagged_false_combination_luminosity = {};
    let runs_lumisections_responsible_for_rule = {};
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
        }
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

        if (
          typeof runs_lumisections_responsible_for_rule[
          rules_why_false_reference
          ] === 'undefined'
        ) {
          runs_lumisections_responsible_for_rule[rules_why_false_reference] = {
            [identifier]: [+ls_index],
          };
        } else {
          // We add the reference on where do this loss occurs for this particular rules:
          runs_lumisections_responsible_for_rule[rules_why_false_reference][
            identifier
          ] = [
              ...(runs_lumisections_responsible_for_rule[
                rules_why_false_reference
              ][identifier] || []),
              +ls_index,
            ];
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

    // Convert runs_lumisections_responsible_for_rule to array of ranges
    for (const [rule, identifiers] of Object.entries(
      runs_lumisections_responsible_for_rule
    )) {
      for (const [identifier, lumisections] of Object.entries(identifiers)) {
        runs_lumisections_responsible_for_rule[rule][
          identifier
        ] = convert_array_of_list_to_array_of_ranges(lumisections);
      }
    }

    return {
      rules_flagged_false_quantity,
      rules_flagged_false_combination,
      rules_flagged_false_quantity_luminosity,
      rules_flagged_false_combination_luminosity,
      runs_lumisections_responsible_for_rule,
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
}
