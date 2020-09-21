const { getNewLumisectionRanges } = require('../controllers/lumisection');
const expect = require('chai').expect;

const sample_oms = require('./lumisection_example');

describe('It generates correct range', () => {
    let new_oms;
    beforeEach(() => {
        new_oms = JSON.parse(JSON.stringify(sample_oms));
    });
    it('Generates range with 1 element changed at random place', () => {
        new_oms[4].cscp_ready = true;
        const new_ranges = getNewLumisectionRanges(sample_oms, new_oms, ['*']);
        expect(new_ranges).to.eql([{ start: 5, end: 5, cscp_ready: true }]);
    });
    it('Generates range with 1 element changed at first place', () => {
        new_oms[0].cscp_ready = true;
        const new_ranges = getNewLumisectionRanges(sample_oms, new_oms, ['*']);
        expect(new_ranges).to.eql([{ start: 1, end: 1, cscp_ready: true }]);
    });
    it('Generates range with 1 element changed at last place', () => {
        new_oms[new_oms.length - 1].cscp_ready = true;
        const new_ranges = getNewLumisectionRanges(sample_oms, new_oms, ['*']);
        expect(new_ranges).to.eql([{ start: 94, end: 94, cscp_ready: true }]);
    });

    it('Generates range with 2 elements changed at last place', () => {
        new_oms[2].cscp_ready = true;
        new_oms[2].dtp_ready = true;
        new_oms[5].ebm_ready = false;
        new_oms[5].hf_ready = false;
        const new_ranges = getNewLumisectionRanges(sample_oms, new_oms, ['*']);
        expect(new_ranges).to.eql([
            { start: 3, end: 3, cscp_ready: true, dtp_ready: true },
            { start: 6, end: 6, ebm_ready: false, hf_ready: false }
        ]);
    });
});
