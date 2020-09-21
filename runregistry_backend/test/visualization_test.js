const axios = require('axios');
const assert = require('assert');
const {
    get_visualization,
    get_all_combination_of_causes_flagged_false,
    get_anti_json_evaluated
} = require('../controllers/visualization_endpoint');
const exp = require('chai').expect;

const golden_logic = `
{
  "and": [
    {
      "or": [
        {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018A/DQM"]},
        {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018B/DQM"]},
        {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018C/DQM"]},
        {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018D/DQM"]},
        {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018E/DQM"]},
        {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018F/DQM"]},
        {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018G/DQM"]}
      ]
    },
    {">=": [{"var": "run.oms.energy"}, 6000]},
    {"<=": [{"var": "run.oms.energy"}, 7000]},
    {">=": [{"var": "run.oms.b_field"}, 3.7]},
    {"in": ["25ns", {"var": "run.oms.injection_scheme"}]},
    {"==": [{"in": ["WMass", {"var": "run.oms.hlt_key"}]}, false]},
    {"==": [{"var": "lumisection.rr.dt-dt"}, "GOOD"]},
    {"==": [{"var": "lumisection.rr.csc-csc"}, "GOOD"]},
    {"==": [{"var": "lumisection.rr.l1t-l1tmu"}, "GOOD"]},
    {"==": [{"var": "lumisection.rr.hlt-hlt"}, "GOOD"]},
    {"==": [{"var": "lumisection.rr.tracker-pixel"}, "GOOD"]},
    {"==": [{"var": "lumisection.rr.tracker-strip"}, "GOOD"]},
    {"==": [{"var": "lumisection.rr.tracker-track"}, "GOOD"]},
    {"==": [{"var": "lumisection.rr.ecal-ecal"}, "GOOD"]},
    {"==": [{"var": "lumisection.rr.ecal-es"}, "GOOD"]},
    {"==": [{"var": "lumisection.rr.hcal-hcal"}, "GOOD"]},
    {"==": [{"var": "lumisection.rr.muon-muon"}, "GOOD"]},
    {"==": [{"var": "lumisection.rr.jetmet-jetmet"}, "GOOD"]},
    {"==": [{"var": "lumisection.rr.lumi-lumi"}, "GOOD"]},
    {"==": [{"var": "lumisection.rr.dc-lowlumi"}, "BAD"]},
    {"==": [{"var": "lumisection.oms.cms_active"}, true]},
    {"==": [{"var": "lumisection.oms.bpix_ready"}, true]},
    {"==": [{"var": "lumisection.oms.fpix_ready"}, true]},
    {"==": [{"var": "lumisection.oms.tibtid_ready"}, true]},
    {"==": [{"var": "lumisection.oms.tecm_ready"}, true]},
    {"==": [{"var": "lumisection.oms.tecp_ready"}, true]},
    {"==": [{"var": "lumisection.oms.castor_ready"}, true]},
    {"==": [{"var": "lumisection.oms.tob_ready"}, true]},
    {"==": [{"var": "lumisection.oms.ebm_ready"}, true]},
    {"==": [{"var": "lumisection.oms.ebp_ready"}, true]},
    {"==": [{"var": "lumisection.oms.eem_ready"}, true]},
    {"==": [{"var": "lumisection.oms.eep_ready"}, true]},
    {"==": [{"var": "lumisection.oms.esm_ready"}, true]},
    {"==": [{"var": "lumisection.oms.esp_ready"}, true]},
    {"==": [{"var": "lumisection.oms.hbhea_ready"}, true]},
    {"==": [{"var": "lumisection.oms.hbheb_ready"}, true]},
    {"==": [{"var": "lumisection.oms.hbhec_ready"}, true]},
    {"==": [{"var": "lumisection.oms.hf_ready"}, true]},
    {"==": [{"var": "lumisection.oms.ho_ready"}, true]},
    {"==": [{"var": "lumisection.oms.dtm_ready"}, true]},
    {"==": [{"var": "lumisection.oms.dtp_ready"}, true]},
    {"==": [{"var": "lumisection.oms.dt0_ready"}, true]},
    {"==": [{"var": "lumisection.oms.cscm_ready"}, true]},
    {"==": [{"var": "lumisection.oms.cscp_ready"}, true]},
    {"==": [{"var": "lumisection.oms.rpc_ready"}, true]},
    {"==": [{"var": "lumisection.oms.beam1_present"}, true]},
    {"==": [{"var": "lumisection.oms.beam2_present"}, true]},
    {"==": [{"var": "lumisection.oms.beam1_stable"}, true]},
    {"==": [{"var": "lumisection.oms.beam2_stable"}, true]}
  ]
}
`;

const denominator_logic = `
{
  "and": [
    {
      "or": [
        {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018A/DQM"]},
        {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018B/DQM"]},
        {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018C/DQM"]},
        {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018D/DQM"]},
        {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018E/DQM"]},
        {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018F/DQM"]},
        {"==": [{"var": "dataset.name"}, "/PromptReco/Collisions2018G/DQM"]}
      ]
    },
    {">=": [{"var": "run.run_number"}, 323414]},
    {"<=": [{"var": "run.run_number"}, 323472]}
  ]
}
`;

describe('Generate correct ranges', () => {
    before(async () => {
        // Add some sample run:
    });

    it('generates correct diff range', async () => {
        get_visualization(golden_logic, denominator_logic);
        // exp(generated_json).to.eql(expected_json);
    });
    it('generates correct range', async () => {});

    after(async () => {});
});
