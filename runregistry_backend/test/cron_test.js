const axios = require('axios');
const assert = require('assert');
const {
    save_runs,
    update_runs,
    manually_update_a_run
} = require('../cron/2.save_or_update_runs');
const { API_URL, OMS_URL, OMS_SPECIFIC_RUN } = require('../config/config')[
    process.env.ENV || 'development'
];
describe('Cron: ', () => {
    // before(done => {
    //     console.log('works');
    //     done();
    // });
    it('Automatic update of run which affects lumisection component statuses', async () => {
        console.log('here');
        const run_number = 327764;
        const {
            data: { data: fetched_run }
        } = await axios.get(`${OMS_URL}/${OMS_SPECIFIC_RUN(run_number)}`);
        const run_oms_attributes = fetched_run[0].attributes;
        // We remove PIXEL from components included to test:
        run_oms_attributes.components = [];
        await update_runs([run_oms_attributes], 0, {});
    });
    after(async () => {
        const run_number = 327764;
        const {
            data: { data: fetched_run }
        } = await axios.get(`${OMS_URL}/${OMS_SPECIFIC_RUN(run_number)}`);
        const run_oms_attributes = fetched_run[0].attributes;
        // We save the run again originally as it was:
        await update_runs([run_oms_attributes], 0, {});
    });
});

// describe('Update runs: ', () => {
//     it('');
// });
