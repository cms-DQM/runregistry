// Common configuration used by all deployment modes
commonVars = {
  // Database config
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'run_registry',
  port: process.env.DB_PORT || 5432,
  host: process.env.DOCKER_POSTGRES ? 'postgres' :
    process.env.DB_HOSTNAME || 'localhost',
  dialect: 'postgres',
  define: {
    // Make sequelize not pluralize the name of tables:
    freezeTableName: true,
  },
  logging: false,
  benchmark: false,
  pool: {
    max: 30,
    min: 0,
    idle: 20000,
    acquire: 2000000,
  },
  // DQMGUI
  WAITING_DQM_GUI_CONSTANT: 'waiting dqm gui',
  DQM_GUI_URL: 'https://cmsweb.cern.ch/dqm/offline/data/json/samples?match=',
  // OMS
  OMS_URL: `https://cmsoms.cern.ch/agg/api/v1`,
  OMS_SPECIFIC_RUN: (run_number) => `runs?filter[run_number]=${run_number}`,
  OMS_LUMISECTIONS: (run_number) => `lumisections?filter[run_number]=${run_number}&page[limit]=5000`,
  CLIENT_ID: 'rr-api-client',
  CLIENT_SECRET: process.env.CLIENT_SECRET,
  OMS_AUDIENCE: 'cmsoms-prod',
  RUNS_PER_API_CALL: 49,
  // Redis
  // redis://:<pass>@<host>:<port>
  REDIS_URL: `redis://${process.env.REDIS_PASSWORD ? ':' + process.env.REDIS_PASSWORD + '@' : ''}${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`,
  // Authentication
  AUTH_SERVICE_URL: 'https://auth.cern.ch/auth/realms/cern/protocol/openid-connect/token',
}

module.exports = {
  // Local development
  development: {
    ...commonVars,
    API_URL: process.env.DOCKER_POSTGRES ? 'http://dev:9500' :
      'http://localhost:9500',
    OMS_RUNS: (number_of_runs = 10) =>
      `runs?sort=-last_update&page[limit]=${number_of_runs}`,
    SECONDS_PER_API_CALL: 30,
    SECONDS_PER_DQM_GUI_CHECK: 6000,
  },
  dev_to_prod: {
    ...commonVars,
    API_URL: process.env.DOCKER_POSTGRES ? 'http://dev:9500' :
      'http://localhost:9500',
    OMS_RUNS: (number_of_runs = 10) =>
      `runs?sort=-last_update&page[limit]=${number_of_runs}`,
    SECONDS_PER_API_CALL: 30,
    SECONDS_PER_DQM_GUI_CHECK: 6000,
  },
  staging: {
    ...commonVars,
    API_URL: 'http://localhost:9500',
    OMS_RUNS: (number_of_runs = 10) =>
      `runs?sort=-last_update&page[limit]=${number_of_runs}`,
    SECONDS_PER_API_CALL: 3600,
    SECONDS_PER_DQM_GUI_CHECK: 3600,
  },
  production: {
    ...commonVars,
    API_URL: 'http://localhost:9500',
    OMS_RUNS: (number_of_runs = 10) =>
      `runs?sort=-last_update&page[limit]=${number_of_runs}`,
    SECONDS_PER_API_CALL: 180,
    SECONDS_PER_DQM_GUI_CHECK: 3600,
  },
  dev_kubernetes: {
    ...commonVars,
    API_URL: 'http://runregistry-backend:9500',
    OMS_RUNS: (number_of_runs = 49) =>
      `runs?sort=-last_update&page[limit]=${number_of_runs}`,
    SECONDS_PER_API_CALL: 30,
    SECONDS_PER_DQM_GUI_CHECK: 600,
  },
  prod_kubernetes: {
    ...commonVars,
    API_URL: 'http://runregistry-backend:9500',
    OMS_RUNS: (number_of_runs = 10) =>
      `runs?sort=-last_update&page[limit]=${number_of_runs}`,
    SECONDS_PER_API_CALL: 180,
    SECONDS_PER_DQM_GUI_CHECK: 3600,
  },

  // The online components are also the rr_lumisection_whitelist
  certifiable_offline_components: {
    btag: ['btag'],
    castor: ['castor'],
    cms: ['cms'],
    csc: ['csc'],
    ctpps: ['ctpps'],
    dc: ['lowlumi'],
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
  },

  certifiable_online_components: {
    castor: ['castor'],
    cms: ['cms'],
    csc: ['csc'],
    ctpps: ['ctpps'],
    dt: ['dt'],
    ecal: ['ecal', 'es'],
    hcal: ['hcal'],
    hlt: ['hlt'],
    l1t: ['l1t', 'l1tcalo', 'l1tmu'],
    lumi: ['lumi'],
    rpc: ['rpc'],
    tracker: ['pixel', 'strip'],
  },
  // This are the attributes we save from OMS lumisections:
  oms_lumisection_whitelist:
    [
      'rp_time_ready', 'cscp_ready',
      'physics_flag', 'dt0_ready',
      'beam1_present', 'bpix_ready',
      'ho_ready', 'dtp_ready',
      'tecm_ready', 'tibtid_ready',
      'fpix_ready', 'rpc_ready',
      'rp_sect_56_ready', 'castor_ready',
      'esp_ready', 'eep_ready',
      'hbhea_ready', 'ebm_ready',
      'dtm_ready', 'eem_ready',
      'esm_ready', 'tecp_ready',
      'ebp_ready', 'hf_ready',
      'rp_sect_45_ready', 'cscm_ready',
      'cms_active', 'zdc_ready',
      'hbheb_ready', 'tob_ready',
      'beam1_stable', 'hbhec_ready',
      'beam2_stable', 'beam2_present',
      'gemp_ready', 'gemm_ready',
    ],
  oms_lumisection_luminosity_whitelist:
    [
      // TODO: When OMS provides us with
      // lumisection granular luminosity then
      // we put the attribute here (not the
      // aggregated one). And then there is
      // no need to calculate it from
      // brilcalc using their pip package
      // For now we use brilcalc:
      'recorded',
      'delivered',
    ],
};
