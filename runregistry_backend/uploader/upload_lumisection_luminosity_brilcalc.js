const { default: PQueue } = require('p-queue');
const { update_runs } = require('../cron/2.save_or_update_runs');
const sequelize = require('../models').sequelize;
const parse = require('csv-parse/lib/sync');
const {
  update_oms_lumisections,
  get_oms_lumisections_for_dataset
} = require('../controllers/lumisection');
const { create_new_version } = require('../controllers/version');

const queue = new PQueue({ concurrency: 1 });
const { readdirSync, readFileSync } = require('fs');

const upload_luminosity = async () => {
  const run_files = readdirSync(`${__dirname}/luminosity`);
  let transaction;

  try {
    transaction = await sequelize.transaction();

    const { atomic_version } = await create_new_version({
      req: { email: 'f.e@cern.ch', comment: 'import luminosity from brilcalc' },
      transaction
    });
    const runs_not_saved = [];
    const promises = run_files.map(run => async () => {
      const run_number = +run.split('.csv')[0];
      if (run_number === 246906) {
        // Only interested in those of 2018
        const file = readFileSync(`${__dirname}/luminosity/${run_number}.csv`, {
          encoding: 'utf8'
        });

        let lumisections = parse(file, {
          columns: [
            'run:fill',
            'ls',
            'time',
            'beamstatus',
            'E(GeV)',
            'delivered(/pb)',
            'recorded(/pb)',
            'avgpu',
            'source'
          ],
          comment: '#',
          skip_lines_with_error: true
        });
        if (lumisections.length > 0) {
          const previous_lumisections = await get_oms_lumisections_for_dataset(
            run_number,
            'online'
          );
          if (previous_lumisections.length < lumisections.length) {
            runs_not_saved.push(run_number);
            console.log('Not saved', runs_not_saved);
          } else {
            lumisections = format_lumisections(
              lumisections,
              previous_lumisections
            );
            try {
              await update_oms_lumisections({
                run_number,
                dataset_name: 'online',
                new_lumisections: lumisections,
                atomic_version,
                transaction,
                req: {
                  email: 'f.e@cern.ch',
                  comment: 'import luminosity from brilcalc'
                }
              });
            } catch (e) {
              console.log(e);
              console.log(run_number);
            }
          }
        }
        if (run_number % 1000 === 0) {
          console.log(run_number);
        }
      }
    });

    await queue.addAll(promises);
  } catch (e) {
    console.log(e);
  }

  transaction.commit();
};

const format_lumisections = (lumisections, oms_lumisections) => {
  if (lumisections.length === 0) {
    return [];
  }
  const formated_lumisections = lumisections.map(lumisection => ({
    lumisection_number: lumisection['ls'].split(':')[0],
    recorded: lumisection['recorded(/pb)'],
    delivered: lumisection['delivered(/pb)']
  }));

  const indexed_by_number = {};
  formated_lumisections.forEach(lumisection => {
    indexed_by_number[+lumisection.lumisection_number - 1] = lumisection;
  });
  // We subtract 1 because it is 1 indexed:
  for (let i = 0; i < formated_lumisections.length; i++) {
    const lumisection_number = +formated_lumisections[i].lumisection_number;
    oms_lumisections[lumisection_number - 1] = {
      ...oms_lumisections[lumisection_number - 1],
      ...indexed_by_number[lumisection_number - 1]
    };
  }
  return oms_lumisections;
};

upload_luminosity();
