const axios = require('axios');
const assert = require('assert');
const { duplicate_datasets } = require('../controllers/dataset');
const { API_URL, OMS_URL, OMS_SPECIFIC_RUN } = require('../config/config')[
    process.env.ENV || 'development'
];
describe('Duplicate datasets', () => {
    const target_dataset_name = '/test_to_delete/dataset/DQM';
    before(async () => {
        // Add some sample run:
    });
    it('Duplicates successfully', async () => {
        const run_numbers = ['328784', '328726', '328731'];
        const source_dataset_name = '/Express/Commissioning2018/DQM';
        const workspaces_to_duplicate_into = ['egamma', 'castor', 'btag'];
        await axios.post(
            `${API_URL}/dc_tools/duplicate_datasets`,
            {
                run_numbers,
                source_dataset_name,
                target_dataset_name,
                workspaces_to_duplicate_into
            },
            {
                headers: { email: 'test@test' }
            }
        );
        // Cleanup
    });
    after(async () => {});
});

// describe('Update runs: ', () => {
//     it('');
// });
