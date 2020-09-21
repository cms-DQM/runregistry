const axios = require('axios');

const { API_URL, WAITING_DQM_GUI_CONSTANT } = require('../config/config')[
  process.env.ENV || 'development'
];

const { update_or_create_dataset } = require('../controllers/dataset');
const {
  fill_dataset_triplet_cache
} = require('../controllers/dataset_triplet_cache');
const {
  create_rr_lumisections,
  create_oms_lumisections
} = require('../controllers/lumisection');
const {
  classify_component_per_lumisection
} = require('../cron/saving_updating_runs_lumisections_utils');

exports.create_offline_waiting_datasets = async (run, transaction) => {
  const { run_number, rr_attributes } = run;
  const { data: datasets_accepted } = await axios.get(
    `${API_URL}/datasets_accepted/${rr_attributes.class}`
  );
  // We get the lumisections from online dataset
  const { data: oms_lumisections } = await axios.post(
    `${API_URL}/lumisections/oms_lumisections`,
    {
      dataset_name: 'online',
      run_number
    }
  );
  const { data: rr_lumisections } = await axios.post(
    `${API_URL}/lumisections/rr_lumisections`,
    {
      dataset_name: 'online',
      run_number
    }
  );

  if (oms_lumisections.length !== rr_lumisections.length) {
    throw 'OMS Lumisection length and RR Lumisection length do not match, please reset the run and then sign off';
  }
  const lumisections = rr_lumisections.map((rr_lumisection, index) => {
    return {
      oms_attributes: oms_lumisections[index],
      rr_attributes: rr_lumisection
    };
  });

  const { data: workspaces } = await axios.get(`${API_URL}/workspaces/offline`);

  const standard_waiting_list_dataset_attributes = {
    global_state: WAITING_DQM_GUI_CONSTANT,
    appeared_in: []
  };
  workspaces.forEach(({ workspace }) => {
    standard_waiting_list_dataset_attributes[
      `${workspace}_state`
    ] = WAITING_DQM_GUI_CONSTANT;
  });

  let { data: classifiers } = await axios.get(
    `${API_URL}/classifiers/component/offline`
  );

  const datasets_accepted_promises = datasets_accepted.map(
    async ({ run_from, run_to, enabled, name }) => {
      if (run_number >= run_from && run_number <= run_to && enabled) {
        const classified_lumisections = classify_dataset_lumisections(
          run,
          lumisections,
          workspaces,
          classifiers
        );
        return await exports.save_individual_dataset({
          dataset_name: name,
          run_number,
          dataset_attributes: standard_waiting_list_dataset_attributes,
          lumisections: classified_lumisections,
          oms_lumisections,
          transaction
        });
      }
    }
  );
  await Promise.all(datasets_accepted_promises);
  return datasets_accepted_promises;
};

// We classify the run information from ONLINE, so that the datasets
const classify_dataset_lumisections = (
  run,
  lumisections,
  workspaces,
  classifiers
) => {
  const dataset_lumisections = [];
  lumisections.forEach(lumisection => {
    // We join the attributes from the run AND the lumisection to produce a per lumisection result:
    // Same as in classifier_playground.js
    const run_and_lumisection_attributes = {
      run: { oms: run.oms_attributes, rr: run.rr_attributes },
      lumisection: {
        oms: lumisection.oms_attributes,
        rr: lumisection.rr_attributes
      }
    };
    const lumisection_components = {};
    workspaces.forEach(({ workspace, columns }) => {
      // We filter the classifiers into those belonging to this specific workspace:
      const workspace_classifiers = classifiers.filter(
        ({ WorkspaceColumn }) => {
          const classifier_workspace = WorkspaceColumn.Workspace.workspace;
          return classifier_workspace === workspace;
        }
      );
      // The namespace rule is the following:
      // Each workspace gets assigned a triplet by workspace-workspace. So csc would be csc-csc. Then other sub_components of that workspace get named workspace-name_of_subcomponent, so occupancy in csc would be csc-occupancy
      columns.forEach(sub_component => {
        // Now we filter the classifiers by column:
        const workspace_column_classifiers = workspace_classifiers.filter(
          ({ WorkspaceColumn }) => {
            const classifier_column = WorkspaceColumn.name;
            return classifier_column === sub_component;
          }
        );

        const name_of_sub_component = `${workspace}-${sub_component}`;
        // Here we assign workspace-sub_component e.g. csc-occupancy or tracker-pix
        lumisection_components[
          name_of_sub_component
        ] = classify_component_per_lumisection(
          run_and_lumisection_attributes,
          workspace_column_classifiers,
          name_of_sub_component
        );
      });
    });
    dataset_lumisections.push(lumisection_components);
  });
  return dataset_lumisections;
};

exports.save_individual_dataset = async ({
  dataset_name,
  run_number,
  dataset_attributes,
  lumisections,
  oms_lumisections,
  transaction,
  event_info
}) => {
  event_info = event_info || {
    email: 'auto@auto',
    comment: 'dataset creation after a run is signed off'
  };

  const { atomic_version } = await create_new_version({
    req: event_info,
    transaction
  });
  // The only reason we do not do this via HTTP is because we want it to be a transaction:
  const saved_dataset = await update_or_create_dataset({
    dataset_name,
    run_number,
    dataset_metadata: dataset_attributes,
    atomic_version,
    transaction
  });
  if (lumisections.length > 0) {
    const saved_lumisections = await create_rr_lumisections({
      run_number,
      dataset_name,
      lumisections,
      req: event_info,
      atomic_version,
      transaction
    });
    const saved_oms_lumisections = await create_oms_lumisections({
      run_number,
      dataset_name,
      lumisections: oms_lumisections,
      req: event_info,
      atomic_version,
      transaction
    });
  }
  await fill_dataset_triplet_cache();
};

const run_and_lumisection_attributes_example = {
  run: {
    oms: {
      energy: 0,
      l1_key: 'l1_trg_cosmics2019/v1',
      b_field: 0.019,
      hlt_key: '/cdaq/special/2019/MWGR1/CruzetForMWGR1/HLT/V2',
      l1_menu: 'L1Menu_Collisions2018_v2_1_0',
      l1_rate: 587.516,
      duration: 1923,
      end_lumi: 0,
      end_time: '2019-03-22T10:20:34Z',
      sequence: 'GLOBAL-RUN',
      init_lumi: 0,
      clock_type: 'LOCAL',
      components: ['DAQ', 'DCS', 'DQM', 'DT', 'SCAL', 'TCDS', 'TRG'],
      run_number: 328766,
      start_time: '2019-03-22T09:48:31Z',
      dt_included: true,
      fill_number: 7495,
      l1_hlt_mode: 'cosmics2019',
      last_update: '2019-03-22T11:48:32Z',
      ls_duration: 95,
      stable_beam: false,
      daq_included: true,
      dcs_included: true,
      dqm_included: true,
      trg_included: true,
      trigger_mode: 'l1_hlt_cosmics2019/v4',
      cmssw_version: 'CMSSW_10_3_3',
      recorded_lumi: null,
      scal_included: true,
      tcds_included: true,
      delivered_lumi: null,
      tier0_transfer: true,
      l1_key_stripped: 'cosmics2019/v1',
      fill_type_party1: 'PB82',
      fill_type_party2: 'PB82',
      hlt_physics_rate: 100.484,
      hlt_physics_size: 3.117,
      fill_type_runtime: 'PB',
      hlt_physics_counter: 189729,
      l1_triggers_counter: 13481,
      l1_hlt_mode_stripped: 'cosmics2019/v4',
      hlt_physics_throughput: 0.00165057,
      initial_prescale_index: 0,
      beams_present_and_stable: false
    },
    rr: {
      class: 'Cosmics19',
      state: 'OPEN',
      significant: true,
      stop_reason: ''
    }
  },
  lumisection: {
    oms: {
      hf_ready: false,
      ho_ready: false,
      dt0_ready: true,
      dtm_ready: false,
      dtp_ready: false,
      ebm_ready: true,
      ebp_ready: true,
      eem_ready: false,
      eep_ready: false,
      esm_ready: false,
      esp_ready: false,
      rpc_ready: false,
      tob_ready: true,
      zdc_ready: false,
      bpix_ready: false,
      cms_active: true,
      cscm_ready: false,
      cscp_ready: false,
      fpix_ready: false,
      tecm_ready: true,
      tecp_ready: true,
      hbhea_ready: false,
      hbheb_ready: false,
      hbhec_ready: false,
      beam1_stable: false,
      beam2_stable: false,
      castor_ready: false,
      physics_flag: false,
      tibtid_ready: true,
      beam1_present: false,
      beam2_present: false,
      rp_time_ready: null,
      rp_sect_45_ready: null,
      rp_sect_56_ready: null
    },
    rr: {
      dt_triplet: { cause: '', status: 'GOOD', comment: '' },
      es_triplet: { cause: '', status: 'EXCLUDED', comment: '' },
      cms_triplet: { cause: '', status: 'BAD', comment: '' },
      csc_triplet: { cause: '', status: 'EXCLUDED', comment: '' },
      hlt_triplet: { cause: '', status: 'GOOD', comment: '' },
      l1t_triplet: { cause: '', status: 'GOOD', comment: '' },
      pix_triplet: { cause: '', status: 'EXCLUDED', comment: '' },
      rpc_triplet: { cause: '', status: 'EXCLUDED', comment: '' },
      ecal_triplet: { cause: '', status: 'EXCLUDED', comment: '' },
      hcal_triplet: { cause: '', status: 'EXCLUDED', comment: '' },
      lumi_triplet: { cause: '', status: 'GOOD', comment: '' },
      ctpps_triplet: { cause: '', status: 'EXCLUDED', comment: '' },
      l1tmu_triplet: { cause: '', status: 'NOTSET', comment: '' },
      strip_triplet: { cause: '', status: 'EXCLUDED', comment: '' },
      castor_triplet: { cause: '', status: 'EXCLUDED', comment: '' },
      l1tcalo_triplet: { cause: '', status: 'NOTSET', comment: '' }
    }
  }
};
