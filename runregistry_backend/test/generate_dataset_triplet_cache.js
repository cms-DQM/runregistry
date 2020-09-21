const {
    fill_dataset_triplet_cache
} = require('../controllers/dataset_triplet_cache');

describe('It generates a correct dataset tripelt cache', () => {
    it('Generates the cache', async () => {
        await fill_dataset_triplet_cache();
    });
});
