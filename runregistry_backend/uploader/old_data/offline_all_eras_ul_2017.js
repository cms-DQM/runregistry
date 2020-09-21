const { Client } = require('pg');
const queue = require('async').queue;
const sequelize = require('../../models').sequelize;
const getAttributesSpecifiedFromArray = require('get-attributes-specified-from-array');

const axios = require('axios');
const {
  save_individual_dataset,
} = require('../../cron_datasets/1.create_datasets');

const connectionString =
  'postgresql://fabioespinosa:@localhost:5432/intermediate_rr_4';
const { API_URL } = require('../../config/config')['development'];
const { oms_lumisection_whitelist } = require('../../config/config');

exports.save_runs_from_old_rr = async (rows, number_of_tries) => {
  const client = new Client({
    connectionString: connectionString,
  });
  await client.connect();

  if (!rows) {
    // This script requires that the runs that exist in the offline table MUST exist already in the online, and be already inserted
    const result = await client.query(`
            select offline.* from offline 
            where run_number > 1 and run_number <= 350000 and rda_name <> '/Global/Online/ALL'  and (rda_name similar to '/ReReco/Run2017__UL2019/DQM')
            and (lumisection_ranges_global is not null)
            order by run_number ASC;
        `);
    rows = result.rows;
  }
  let saved_datasets = 0;
  const runs_not_saved = [];
  const promises = rows.map((row) => async () => {
    try {
      let {
        run_number,
        rda_name: dataset_name,
        workspace_states,
        lumisection_ranges,
        workspace_user,
        rda_created,
        workspace_comments,
        lumisection_ranges_global,
        lumisection_ranges_btag,
        lumisection_ranges_castor,
        lumisection_ranges_csc,
        lumisection_ranges_ctpps,
        lumisection_ranges_dt,
        lumisection_ranges_ecal,
        lumisection_ranges_egamma,
        lumisection_ranges_hcal,
        lumisection_ranges_hlt,
        lumisection_ranges_jetmet,
        lumisection_ranges_l1t,
        lumisection_ranges_lumi,
        lumisection_ranges_muon,
        lumisection_ranges_rpc,
        lumisection_ranges_tau,
        lumisection_ranges_tracker,
      } = row;
      const workspace_lumisections = {
        btag: lumisection_ranges_btag,
        castor: lumisection_ranges_castor,
        csc: lumisection_ranges_csc,
        ctpps: lumisection_ranges_ctpps,
        dt: lumisection_ranges_dt,
        ecal: lumisection_ranges_ecal,
        egamma: lumisection_ranges_egamma,
        global: lumisection_ranges_global,
        hcal: lumisection_ranges_hcal,
        hlt: lumisection_ranges_hlt,
        jetmet: lumisection_ranges_jetmet,
        l1t: lumisection_ranges_l1t,
        lumi: lumisection_ranges_lumi,
        muon: lumisection_ranges_muon,
        rpc: lumisection_ranges_rpc,
        tau: lumisection_ranges_tau,
        tracker: lumisection_ranges_tracker,
      };

      const preformatted_workspace_lumisections = expand_ranges_to_lumisections(
        workspace_lumisections
      );

      let final_lumisections = preformatted_workspace_lumisections.global;
      // Account for CTPPS exceptions which for those, we will need to check the ctpps workspace lumisections, and those overwrite gobal, since they dont ever get synced into global
      if (
        final_lumisections &&
        preformatted_workspace_lumisections.ctpps !== null
      ) {
        final_lumisections = apply_overwrite(
          final_lumisections,
          preformatted_workspace_lumisections.ctpps,
          ['ctpps45_ready', 'ctpps56_ready']
        );
      }

      // If global lumisections exist, we stick with those, else we will try to resolve conflicts between them according to priority (certain lumisections are authoritative from certain worspaces)
      if (!final_lumisections) {
        final_lumisections = calculate_compound_lumisections(
          run_number,
          dataset_name,
          preformatted_workspace_lumisections
        );
      }

      const rr_lumisections = generate_rr_lumisections(
        row,
        final_lumisections,
        preformatted_workspace_lumisections['global']
      );
      const oms_lumisections = generate_oms_lumisections(
        row,
        final_lumisections
      );
      if (rr_lumisections.length !== oms_lumisections.length) {
        throw 'Lumisection length mismatch';
      }
      const new_workspace_states = {};
      for (const [key, val] of Object.entries(workspace_states)) {
        new_workspace_states[`${key.toLowerCase()}_state`] = val;
      }
      // State of each workspace:
      const dataset_attributes = {
        ...new_workspace_states,
      };

      await axios.post(
        `${API_URL}/datasets`,
        {
          run_number,
          dataset_name,
          dataset_attributes,
          rr_lumisections,
          oms_lumisections,
        },
        {
          headers: {
            email: `auto@auto ${
              workspace_user
                ? workspace_user.global && workspace_user.global
                : ''
            }`,
            comment:
              'migration of all workspaces of all eras from UL2017 in old RR',
          },
          maxContentLength: 52428890000,
        }
      );
      saved_datasets += 1;
    } catch (e) {
      runs_not_saved.push(row);
      console.log(e);
    }
  });
  const number_of_workers = 1;
  const asyncQueue = queue(async (run) => await run(), number_of_workers);

  // When runs finished saving:
  asyncQueue.drain = async () => {
    console.log(`${saved_datasets} dataset(s) saved`);
    if (runs_not_saved.length > 0) {
      const run_numbers_of_runs_not_saved = runs_not_saved.map(
        ({ run_number }) => run_number
      );
      console.log(
        `WARNING: ${runs_not_saved.length} run(s) were not saved. They are: ${run_numbers_of_runs_not_saved}.`
      );
      console.log('------------------------------');
      console.log('------------------------------');
      if (number_of_tries < 4) {
        console.log(`TRYING AGAIN: with ${runs_not_saved.length} run(s)`);
        number_of_tries += 1;
        await exports.save_runs_from_old_rr(runs_not_saved, number_of_tries);
      } else {
        console.log(
          `After trying 4 times, ${run_numbers_of_runs_not_saved} dataset(s) were not saved`
        );
      }
    }
  };
  asyncQueue.error = (err) => {
    console.log(`Critical error saving runs, ${JSON.stringify(err)}`);
  };

  asyncQueue.push(promises);
};

(async () => exports.save_runs_from_old_rr(undefined, 1))();

// It will expand the object which contains on each attribute the lumisection of the respective workspace
const expand_ranges_to_lumisections = (workspace_lumisections) => {
  const new_workspace_lumisections = {};

  for (const [key, lumisection_ranges] of Object.entries(
    workspace_lumisections
  )) {
    if (lumisection_ranges === null) {
      new_workspace_lumisections[key] = null;
    } else {
      const lumisections = [];
      lumisection_ranges.forEach((range) => {
        const { rdr_section_from, rdr_section_to } = range;
        for (let i = rdr_section_from; i <= rdr_section_to; i++) {
          lumisections.push(range);
        }
      });
      new_workspace_lumisections[key] = lumisections;
    }
  }
  return new_workspace_lumisections;
};

// This will first see which lumisection arrays actually exist,
// then it will apply priority to see which attributes to import from which
const calculate_compound_lumisections = (
  run_number,
  dataset_name,
  all_workspace_lumisections
) => {
  const existing_lumisections = {};
  for (const [key, workspace_lumisections] of Object.entries(
    all_workspace_lumisections
  )) {
    if (workspace_lumisections) {
      existing_lumisections[key] = workspace_lumisections;
    }
  }
  if (Object.keys(existing_lumisections).length === 0) {
    throw `No lumisections exist for ${run_number}, ${dataset_name} in any workspace`;
  }

  let final_lumisections =
    existing_lumisections['ctpps'] ||
    existing_lumisections[Object.keys(existing_lumisections)[0]];
  // We now need to apply priority to the attributes of the lumisections that do exist
  try {
    for (const [key, workspace_lumisections] of Object.entries(
      existing_lumisections
    )) {
      if (key === 'tracker') {
        final_lumisections = apply_overwrite(
          final_lumisections,
          workspace_lumisections,
          [
            'bpix_ready',
            'fpix_ready',
            'pix_status',
            'lse_strip',
            'tecm_ready',
            'tecp_ready',
            'tibtid_ready',
            'tob_ready',
            'lse_track',
          ]
        );
      }
      if (key === 'csc') {
        final_lumisections = apply_overwrite(
          final_lumisections,
          workspace_lumisections,
          ['lse_csc', 'cscm_ready', 'cscp_ready']
        );
      }
      if (key === 'dt') {
        final_lumisections = apply_overwrite(
          final_lumisections,
          workspace_lumisections,
          ['dt0_ready', 'lse_dt', 'dtm_ready', 'dtp_ready']
        );
      }
      if (key === 'ecal') {
        final_lumisections = apply_overwrite(
          final_lumisections,
          workspace_lumisections,
          [
            'ebm_ready',
            'ebp_ready',
            'lse_ecal',
            'eem_ready',
            'esm_ready',
            'esp_ready',
            'eep_ready',
            'lse_es',
          ]
        );
      }
      if (key === 'hcal') {
        final_lumisections = apply_overwrite(
          final_lumisections,
          workspace_lumisections,
          [
            'hbhea_ready',
            'hbheb_ready',
            'hbhec_ready',
            'lse_hcal',
            'hf_ready',
            'ho_ready',
          ]
        );
      }
      if (key === 'hlt') {
        final_lumisections = apply_overwrite(
          final_lumisections,
          workspace_lumisections,
          ['lse_hlt']
        );
      }
      if (key === 'l1t') {
        final_lumisections = apply_overwrite(
          final_lumisections,
          workspace_lumisections,
          ['lse_l1tcalo', 'lse_l1tmu']
        );
      }
      if (key === 'lumi') {
        final_lumisections = apply_overwrite(
          final_lumisections,
          workspace_lumisections,
          ['lse_lumi']
        );
      }
      if (key === 'rpc') {
        final_lumisections = apply_overwrite(
          final_lumisections,
          workspace_lumisections,
          ['rpc_ready', 'lse_rpc']
        );
      }
    }
    return final_lumisections;
  } catch (err) {
    if (err.message === 'Lumisection length mismatch') {
      throw `Lumisection length mismatch for ${run_number}, ${dataset_name}`;
    }
  }
};

const apply_overwrite = (
  lumisections,
  workspace_lumisections,
  exceptions_to_overwrite
) => {
  if (lumisections.length !== workspace_lumisections.length) {
    throw 'Lumisection length mismatch';
  }
  lumisections = lumisections.map((current_lumisection, index) => {
    const overwrite_with = workspace_lumisections[index];
    const attributes_to_overwrite = {};
    exceptions_to_overwrite.forEach((exception) => {
      attributes_to_overwrite[exception] = overwrite_with[exception];
    });
    return { ...current_lumisection, ...attributes_to_overwrite };
  });
  return lumisections;
};

// Go from run to lumisections (per component)

const generate_rr_lumisections = (row, lumisections, global_lumisections) => {
  if (lumisections === null || !lumisections) {
    throw 'Lumisections cannot be null';
  }
  if (global_lumisections !== null) {
    if (lumisections.length !== global_lumisections.length) {
      throw 'global length lumisection mismatch';
    }
  }
  if (global_lumisections === null) {
    global_lumisections = lumisections;
  }
  return lumisections.map((lumisection, index) => {
    const global_lumisection = global_lumisections[index];
    // -private means they are those components which were edited in local workspace (to prevent losing data that was out of sync with global)
    const current_lumisection = {
      'ctpps-ctpps': {
        status: calculate_ctpps_status(row, lumisection),
        comment: '',
        cause: '',
      },
    };
    for (let [key, triplet] of Object.entries(row)) {
      // if it includes "-" it is a triplet.
      if (key.includes('-')) {
        let workspace = key.split('-')[0];
        let component = key.split('-')[1];
        let global_workspace = false;
        if (workspace === 'global' && component === 'ctpps') {
          // we don't import ctpps in global:
          continue;
        }
        if (
          workspace === 'ctpps' &&
          (component.startsWith('trk') || component.startsWith('time'))
        ) {
          // All trk and time are not to be imported from ctpps:
          continue;
        }
        // We want to change pix for pixel
        if (component === 'pix') {
          component = 'pixel';
        }
        if (component === 'tracking') {
          component = 'track';
        }
        if (workspace !== 'global') {
          // We want to make the es-es columns into es-es_private
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
            tracker: ['track', 'pixel', 'strip'],
          };

          if (list_of_certifiable_columns[workspace].includes(component)) {
            component = `${component}_private`;
          }
        }
        if (workspace === 'global') {
          global_workspace = true;
          // we want to make global the new local columns, so for example global-rpc will become rpc-rpc, unless we have  global-pixel, which should belong to tracker-pixel
          if (component === 'es') {
            workspace = 'ecal';
          } else if (component === 'l1tcalo' || component === 'l1tmu') {
            workspace = 'l1t';
          } else if (component === 'lowlumi') {
            workspace = 'dt';
          } else if (
            component === 'strip' ||
            component === 'track' ||
            component === 'pixel'
          ) {
            workspace = 'tracker';
          } else {
            if (component !== 'ctpps') {
              // ctpps was set up, in the ctpss-ctpps up
              workspace = component;
            }
          }
        }

        let final_status = 'NOTSET';
        if (triplet === null) {
          final_status = 'NOTSET';
        } else if (triplet.status !== 'GOOD') {
          final_status = triplet.status;
        }
        // If it is one of the columns set in the lumisection table, we must check if we can apply the lumisection bit (lse_castor, lse_csc, ...):
        else if (
          [
            'castor',
            'csc',
            'dt',
            'ecal',
            'es',
            'hcal',
            'hlt',
            'l1t',
            'l1tcalo',
            'l1tmu',
            'lowlumi',
            'lumi',
            'rpc',
            'strip',
            'track',
            'pixel',
          ].includes(component.split('_private')[0])
        ) {
          let ls_status;
          // If we are in the global workspace, we import the global lumisections:
          if (global_workspace) {
            ls_status = global_lumisection[`lse_${component}`];
            if (component.startsWith('pix')) {
              ls_status = global_lumisection[`lse_pix`];
            }
          } else {
            ls_status = lumisection[`lse_${component}`];
            if (component.startsWith('pix')) {
              ls_status = lumisection[`lse_pix`];
            }
          }
          // It was good in the first place:
          if (ls_status === null && component !== 'lowlumi') {
            final_status = 'GOOD';
          }
          // Low lumi will only be GOOD if it was indeed set to true on a lumisection basis, else is BAD:
          else if (ls_status === null && component === 'lowlumi') {
            final_status = 'BAD';
          } else if (ls_status === 1) {
            final_status = 'GOOD';
          } else {
            // other scenario is 0:
            final_status = 'BAD';
          }
        } else {
          if (workspace !== 'ctpps') {
            final_status = 'GOOD';
          }
          // ctpps has special case (ctpps45_ready is the same as ctpps45 status)
          if (workspace === 'ctpps') {
            if (component === 'rp45_cyl') {
              // rp45_cyl is to be renamed to Time45_cyl, as well as rp56_cyl
              key = 'ctpps-time45_cyl';
            }
            if (component === 'rp56_cyl') {
              key = 'ctpps-time56_cyl';
            }
            if (
              lumisection['ctpps45_ready'] === 1 ||
              lumisection['ctpps56_ready'] === 1
            ) {
              final_status = 'GOOD';
            } else {
              final_status = 'BAD';
            }
          }
        }
        // Lowlumi will get its own column in the dc workspace:
        if (component === 'lowlumi') {
          key = `dc-${component}`;
        } else {
          key = `${workspace}-${component}`;
        }
        current_lumisection[key] = {
          status: final_status,
          comment: triplet ? triplet.comment : '',
          cause: triplet ? triplet.cause : '',
        };
      }
    }
    return current_lumisection;
  });
};

const generate_oms_lumisections = (row, lumisections) => {
  if (lumisections === null || !lumisections) {
    throw 'Lumisections cannot be null';
  }
  return lumisections.map((lumisection) => {
    const current_lumisection = {};
    // filter for OMS attributes:
    lumisection = getAttributesSpecifiedFromArray(
      lumisection,
      oms_lumisection_whitelist
    );
    for (let [key, value] of Object.entries(lumisection)) {
      if (value === null) {
        value = 0;
      }
      if (value !== 1 && value !== 0) {
        throw `Value supposed to be boolean for ${key} and was ${value}`;
      }
      // We convert 1s and 0s to true and false:
      current_lumisection[key] = !!value;
    }
    return current_lumisection;
  });
};

// Returns the new ctpps status:
const calculate_ctpps_status = (row, lumisection) => {
  if (lumisection.ctpps45_ready === 1 || lumisection.ctpps56_ready === 1) {
    //
    // In case they are null:
    row.rp45_210 = row['ctpps-rp45_210'] || {};
    row.rp45_220 = row['ctpps-rp45_220'] || {};
    row.rp45_cyl = row['ctpps-rp45_cyl'] || {};
    row.rp56_210 = row['ctpps-rp56_210'] || {};
    row.rp56_220 = row['ctpps-rp56_220'] || {};
    row.rp56_cyl = row['ctpps-rp56_cyl'] || {};
    if (
      (row.rp45_210.status === 'GOOD' && row.rp45_220.status === 'GOOD') ||
      (row.rp45_cyl.status === 'GOOD' && row.rp45_210.status === 'GOOD') ||
      (row.rp45_cyl.status === 'GOOD' && row.rp45_220.status === 'GOOD') ||
      (row.rp56_210.status === 'GOOD' && row.rp56_220.status === 'GOOD') ||
      (row.rp56_220.status === 'GOOD' && row.rp56_cyl.status === 'GOOD') ||
      (row.rp56_210.status === 'GOOD' && row.rp56_cyl.status === 'GOOD')
    ) {
      return 'GOOD';
    }
  }
  return 'BAD';
};
