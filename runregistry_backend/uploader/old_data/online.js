const { Client } = require('pg');
const queue = require('async').queue;

const axios = require('axios');

const connectionString =
  'postgresql://fabioespinosa:@localhost:5432/intermediate_rr_2';
const { API_URL } = require('../../config/config')['development'];
const { oms_lumisection_whitelist } = require('../../config/config');
const getAttributesSpecifiedFromArray = require('get-attributes-specified-from-array');

exports.save_runs_from_old_rr = async (rows, number_of_tries, interval = 0) => {
  const client = new Client({
    connectionString: connectionString
  });
  await client.connect();
  const interval_length = 10000;
  const starting_point = 123000; //123000;
  if (!rows) {
    const result = await client.query(`
            select * from online 
            where (workspace_states -> 'global') is not null and lumisections is not null and run_number > ${starting_point +
              interval * interval_length} and run_number <= ${starting_point +
      (interval + 1) * interval_length}
            order by run_number ASC
        `);
    rows = result.rows;
  }
  let saved_runs = 0;
  const runs_not_saved = [];
  const promises = rows.map(row => async () => {
    try {
      let {
        run_number,
        run_class_name,
        run_stop_reason,
        lumisections,
        run_short,
        run_aud_user,
        workspace_states
      } = row;

      if (lumisections === null || !lumisections) {
        throw 'Lumisections cannot be null';
      }

      const rr_lumisections = generate_rr_lumisections(row, lumisections);

      const oms_lumisections = generate_oms_lumisections(row, lumisections);

      const rr_attributes = {
        class: run_class_name,
        stop_reason: run_stop_reason,
        significant: true,
        short_run: run_short,
        state: workspace_states.global
      };
      const oms_attributes = {
        run_number,
        ls_duration: rr_lumisections.length
      };

      await axios.put(
        `${API_URL}/automatic_run_update/${run_number}`,
        {
          oms_attributes,
          oms_lumisections,
          rr_attributes,
          rr_lumisections
        },
        {
          headers: {
            email: `auto@auto MIG: ${run_aud_user}`,
            comment: 'run migration from RR correction',
            egroups: 'egroup;'
          },
          maxContentLength: 524288900
        }
      );
      saved_runs += 1;
    } catch (e) {
      runs_not_saved.push(row);
      console.log(e);
    }
  });
  const number_of_workers = 1;
  const asyncQueue = queue(async run => await run(), number_of_workers);

  // When runs finished saving:
  asyncQueue.drain = async () => {
    console.log(`${saved_runs} run(s) updated`);
    if (runs_not_saved.length > 0) {
      const run_numbers_of_runs_not_saved = runs_not_saved.map(
        ({ run_number }) => run_number
      );
      console.log(
        `WARNING: ${runs_not_saved.length} run(s) were not updated. They are: ${run_numbers_of_runs_not_saved}.`
      );
      console.log('------------------------------');
      console.log('------------------------------');
      if (number_of_tries < 4) {
        console.log(`TRYING AGAIN: with ${runs_not_saved.length} run(s)`);
        number_of_tries += 1;
        await exports.save_runs_from_old_rr(runs_not_saved, number_of_tries);
      } else {
        console.log(
          `After trying 4 times, ${run_numbers_of_runs_not_saved} run(s) were not updated`
        );
      }
    }
    const result = await client.query(`
            select * from online 
            where (workspace_states -> 'global') is not null and lumisections is not null and run_number > ${starting_point +
              (interval + 1) *
                interval_length} and run_number <= ${starting_point +
      (interval + 2) * interval_length}
            order by run_number ASC
        `);
    rows = result.rows;
    if (starting_point + (interval + 2) * interval_length < 400000) {
      // if there are still runs to be saved:
      await exports.save_runs_from_old_rr(rows, 0, interval + 1);
    }
  };
  asyncQueue.error = err => {
    console.log(`Critical error saving runs, ${JSON.stringify(err)}`);
  };

  asyncQueue.push(promises);
};

(async () => exports.save_runs_from_old_rr(undefined, 1))();

const expand_ranges_to_lumisections = lumisection_ranges => {
  const lumisections = [];
  lumisection_ranges.forEach(range => {
    const { rdr_section_from, rdr_section_to } = range;
    for (let i = rdr_section_from; i <= rdr_section_to; i++) {
      lumisections.push(range);
    }
  });
  return lumisections;
};

// Go from run to lumisections (per component)
const generate_rr_lumisections = (row, lumisections) => {
  if (lumisections === null || !lumisections) {
    throw 'Lumisections cannot be null';
  }
  return lumisections.map(lumisection => {
    const current_lumisection = {};
    for (let [key, triplet] of Object.entries(row)) {
      // If key includes '-' it is a component triplet:
      if (key.includes('-')) {
        let workspace = key.split('-')[0];
        let component = key.split('-')[1];
        if (component === 'pix') {
          component = 'pixel';
        }
        if (component === 'tracking') {
          component = 'track';
        }
        // The following will be replaced by the global one (l1t-l1tmu, l1t-l1tcalo, tracker-pix, tracker-strip, ecal-es)
        if (workspace !== 'global') {
          const list_of_certifiable_columns = {
            btag: ['btag'],
            castor: ['castor'],
            cms: ['cms'],
            csc: ['csc'],
            ctpps: ['ctpps'],
            dt: ['dt'],
            ecal: ['ecal', 'es'],
            egamma: ['egamma'],
            hcal: ['hcal'],
            hlt: ['hlt'],
            jetmet: ['jetmet'],
            l1t: ['l1t', 'l1tmu', 'l1tcalo'],
            lumi: ['lumi'],
            muon: ['muon'],
            rpc: ['rpc'],
            tau: ['tau'],
            tracker: ['track', 'pixel', 'strip']
          };
          if (list_of_certifiable_columns[workspace].includes(component)) {
            component = `${component}_private`;
          }
        }
        let final_status = 'NOTSET';

        if (triplet === null) {
          final_status = 'NOTSET';
        } else {
          final_status = triplet.status;
        }
        if (key.startsWith('global-')) {
          if (component === 'l1tmu' || component === 'l1tcalo') {
            key = `l1t-${component}`;
          } else if (
            component === 'pixel' ||
            component === 'strip' ||
            component === 'track'
          ) {
            key = `tracker-${component}`;
          } else if (component === 'es') {
            key = `ecal-${component}`;
          } else {
            key = `${component}-${component}`;
          }
        } else {
          key = `${workspace}-${component}`;
        }
        current_lumisection[key] = {
          status: final_status,
          comment: triplet ? triplet.comment : '',
          cause: triplet ? triplet.cause : ''
        };
      }
    }
    return current_lumisection;
  });
};

const generate_oms_lumisections = (row, lumisections) => {
  return lumisections.map(lumisection => {
    const current_lumisection = {};
    lumisection = getAttributesSpecifiedFromArray(
      lumisection,
      oms_lumisection_whitelist
    );
    for (let [key, value] of Object.entries(lumisection)) {
      if (!key.startsWith('lse_') && !key.startsWith('rdr_')) {
        if (key === 'lhcfill') {
          // lhcfill is a number, no need to convert it:
          current_lumisection[key] = value;
        } else {
          if (value === null) {
            value = 0;
          }
          if (value !== 1 && value !== 0) {
            throw `Value supposed to be boolean for ${key} and was ${value}`;
          }
          // We convert 1s and 0s to true and false:
          current_lumisection[key] = !!value;
        }
      }
    }
    return current_lumisection;
  });
};
