const {
  is_run_significant
} = require('../cron/saving_updating_runs_lumisections_utils');

const {
  get_OMS_lumisections
} = require('../cron/saving_updating_runs_lumisections_utils');
const {
  calculate_rr_attributes,
  calculate_rr_lumisections,
  calculate_oms_attributes
} = require('../cron/3.calculate_rr_attributes');

describe('Significant test', async () => {
  const event1 = {
    energy: 0,
    l1_key: 'l1_trg_cosmics2019/v20',
    b_field: 0.019,
    hlt_key: '/cdaq/special/2019/MWGR1/CruzetForMWGR1/HLT/V9',
    l1_menu: 'L1Menu_Collisions2018_v2_1_0',
    l1_rate: null,
    duration: null,
    end_lumi: 0,
    end_time: null,
    sequence: 'GLOBAL-RUN',
    init_lumi: 0,
    clock_type: 'LOCAL',
    components: ['DAQ', 'DCS', 'DQM', 'DT', 'HCAL', 'SCAL', 'TCDS', 'TRG'],
    run_number: 334614,
    start_time: '2020-01-24T18:40:08Z',
    dt_included: true,
    fill_number: 7495,
    l1_hlt_mode: 'cosmics2019',
    last_update: '2020-01-24T18:43:20Z',
    ls_duration: 504,
    stable_beam: false,
    daq_included: true,
    dcs_included: true,
    dqm_included: true,
    trg_included: true,
    trigger_mode: 'l1_hlt_cosmics2019/v44',
    cmssw_version: 'CMSSW_10_6_8_patch1',
    hcal_included: true,
    recorded_lumi: null,
    scal_included: true,
    tcds_included: true,
    delivered_lumi: null,
    tier0_transfer: true,
    l1_key_stripped: 'cosmics2019/v20',
    fill_type_party1: 'PB82',
    fill_type_party2: 'PB82',
    hlt_physics_rate: 154.126,
    hlt_physics_size: 2.677,
    fill_type_runtime: 'COSMICS',
    hlt_physics_counter: 28742,
    l1_triggers_counter: null,
    l1_hlt_mode_stripped: 'cosmics2019/v44',
    hlt_physics_throughput: 0.01435644,
    initial_prescale_index: 0,
    beams_present_and_stable: false
  };

  const event2 = {
    energy: 0,
    end_lumi: 0,
    init_lumi: 0,
    fill_number: 7495,
    last_update: '2020-01-24T14:59:34Z',
    ls_duration: 67,
    fill_type_party1: 'PB82',
    fill_type_party2: 'PB82',
    hlt_physics_rate: 7.061,
    hlt_physics_size: 0.139,
    fill_type_runtime: 'COSMICS',
    hlt_physics_counter: 10040,
    hlt_physics_throughput: 0.00009764,
    initial_prescale_index: 0
  };
  // const run = { ...event1, ...event2 };
  const run = event1;

  const oms_lumisections = [
    {
      end_lumi: null,
      hf_ready: true,
      ho_ready: false,
      dt0_ready: true,
      dtm_ready: true,
      dtp_ready: true,
      ebm_ready: true,
      ebp_ready: true,
      eem_ready: false,
      eep_ready: false,
      esm_ready: false,
      esp_ready: false,
      init_lumi: null,
      rpc_ready: false,
      tob_ready: false,
      zdc_ready: false,
      bpix_ready: false,
      cms_active: true,
      cscm_ready: false,
      cscp_ready: false,
      fpix_ready: false,
      tecm_ready: false,
      tecp_ready: false,
      hbhea_ready: false,
      hbheb_ready: false,
      hbhec_ready: false,
      beam1_stable: false,
      beam2_stable: false,
      castor_ready: false,
      physics_flag: false,
      tibtid_ready: false,
      beam1_present: false,
      beam2_present: false,
      recorded_lumi: null,
      rp_time_ready: null,
      delivered_lumi: null,
      rp_sect_45_ready: null,
      rp_sect_56_ready: null,
      live_lumi_per_lumi: null,
      recorded_lumi_per_lumi: null,
      delivered_lumi_per_lumi: null
    },
    {
      end_lumi: null,
      hf_ready: true,
      ho_ready: false,
      dt0_ready: true,
      dtm_ready: true,
      dtp_ready: true,
      ebm_ready: true,
      ebp_ready: true,
      eem_ready: false,
      eep_ready: false,
      esm_ready: false,
      esp_ready: false,
      init_lumi: null,
      rpc_ready: false,
      tob_ready: false,
      zdc_ready: false,
      bpix_ready: false,
      cms_active: true,
      cscm_ready: false,
      cscp_ready: false,
      fpix_ready: false,
      tecm_ready: false,
      tecp_ready: false,
      hbhea_ready: false,
      hbheb_ready: false,
      hbhec_ready: false,
      beam1_stable: false,
      beam2_stable: false,
      castor_ready: false,
      physics_flag: false,
      tibtid_ready: false,
      beam1_present: false,
      beam2_present: false,
      recorded_lumi: null,
      rp_time_ready: null,
      delivered_lumi: null,
      rp_sect_45_ready: null,
      rp_sect_56_ready: null,
      live_lumi_per_lumi: null,
      recorded_lumi_per_lumi: null,
      delivered_lumi_per_lumi: null
    }
  ];
  it('Generates significance correctly', async () => {
    // const oms_lumisections = await get_OMS_lumisections(run.run_number);
    const oms_lumisections = [];
    const oms_attributes = await calculate_oms_attributes(
      run,
      oms_lumisections
    );
    Object.freeze(oms_lumisections);
    Object.freeze(oms_attributes);

    const rr_attributes = await calculate_rr_attributes(
      oms_attributes,
      oms_lumisections
    );

    const significant = await is_run_significant(
      oms_attributes,
      rr_attributes,
      oms_lumisections
    );
    console.log(significant);
  });
});
