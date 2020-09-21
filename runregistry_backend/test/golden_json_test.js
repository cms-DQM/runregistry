const fs = require('fs');
const queue = require('async').queue;
const {
    get_datasets_with_filter,
    generate_golden_json_for_dataset
} = require('../controllers/json_creation');
const previous_json = fs.readFileSync(`${__dirname}/previous_json.json`);

const rr_columns_required_to_be_good = [
    // ['cms-cms', 'GOOD'],
    ['dt-dt', 'GOOD'],
    ['csc-csc', 'GOOD'],
    ['l1t-l1tcalo', 'GOOD'],
    ['l1t-l1tmu', 'GOOD'],
    ['hlt-hlt', 'GOOD'],
    ['tracker-pixel', 'GOOD'],
    ['tracker-strip', 'GOOD'],
    ['tracker-track', 'GOOD'],
    ['ecal-ecal', 'GOOD'],
    ['ecal-es', 'GOOD'],
    ['hcal-hcal', 'GOOD'],
    ['egamma-egamma', 'GOOD'],
    ['muon-muon', 'GOOD'],
    ['jetmet-jetmet', 'GOOD'],
    ['lumi-lumi', 'GOOD'],
    // low lumi should be BAD (as it is )
    ['dc-lowlumi', 'BAD']
];

const oms_columns_required_to_be_good = [
    ['cms_active', true],
    ['bpix_ready', true],
    ['fpix_ready', true],
    ['tibtid_ready', true],
    ['tecm_ready', true],
    ['tecp_ready', true],
    // ['castor_ready', true],
    ['tob_ready', true],
    ['ebm_ready', true],
    ['ebp_ready', true],
    ['eem_ready', true],
    ['eep_ready', true],
    ['esm_ready', true],
    ['esp_ready', true],
    ['hbhea_ready', true],
    ['hbheb_ready', true],
    ['hbhec_ready', true],
    ['hf_ready', true],
    ['ho_ready', true],
    ['dtm_ready', true],
    ['dtp_ready', true],
    ['dt0_ready', true],
    ['cscm_ready', true],
    ['cscp_ready', true],
    ['rpc_ready', true],
    ['beam1_present', true],
    ['beam2_present', true],
    ['beam1_stable', true],
    ['beam2_stable', true]
];

describe('Generate golden json', () => {
    for (let year = 2018; year <= 2018; year++) {
        // const year = 2017;
        // const dataset_nameA = 'online';
        it('Fails with no array', async () => {
            // Call with invalid array:
        });
        it('Generates correct json', async () => {
            // const parsed_json = JSON.parse(previous_json);
            const dataset_filter = {
                // name: {
                //     like: '/PromptReco%'
                // }
                and: [
                    {
                        or: [
                            { name: `/PromptReco/Collisions${year}A/DQM` },
                            { name: `/PromptReco/Collisions${year}B/DQM` },
                            { name: `/PromptReco/Collisions${year}C/DQM` },
                            { name: `/PromptReco/Collisions${year}D/DQM` },
                            { name: `/PromptReco/Collisions${year}E/DQM` },
                            { name: `/PromptReco/Collisions${year}F/DQM` },
                            { name: `/PromptReco/Collisions${year}G/DQM` },
                            { name: `/PromptReco/Collisions${year}H/DQM` },
                            { name: `/PromptReco/Collisions${year}I/DQM` }
                        ]
                    }
                ]
            };
            const run_filter = {
                and: [
                    // 'rr_attributes.class': 'Collisions18'
                    {
                        'oms_attributes.energy': {
                            '>=': 6000
                        }
                    },
                    {
                        'oms_attributes.energy': {
                            '<=': 7000
                        }
                    },
                    {
                        'oms_attributes.b_field': {
                            '>=': 3.7
                        }
                    },
                    {
                        'oms_attributes.injection_scheme': {
                            like: '25ns%'
                        }
                    },
                    {
                        'oms_attributes.hlt_key': {
                            notlike: '%WMass%'
                        }
                    }
                ]
            };
            let final_json = await get_jsons_for_dataset_filter(
                dataset_filter,
                run_filter
            );

            console.log('finished');
            fs.writeFileSync(
                `./generated_json${year}.json`,
                JSON.stringify(final_json),
                'utf8'
            );
        });
    }
});

const get_jsons_for_dataset_filter = async (dataset_filter, run_filter) => {
    return new Promise(async (resolve, reject) => {
        const generated_json = {};
        const datasets_that_matched = await get_datasets_with_filter(
            dataset_filter,
            run_filter
        );
        // let counter = 0;
        const promises = datasets_that_matched.map(
            ({ run_number, name }) => async () => {
                try {
                    const ranges = await generate_golden_json_for_dataset({
                        run_number,
                        dataset_name: name,
                        rr_columns_required_to_be_good,
                        oms_columns_required_to_be_good
                    });

                    // counter += ranges;
                    if (ranges.length > 0) {
                        console.log(ranges);
                        generated_json[run_number] = ranges;
                    }
                } catch (e) {
                    console.log(`Not generated for run: ${run_number}`);
                    console.log(e);
                }
            }
        );
        const number_of_workers = 2;
        const asyncQueue = queue(
            async promise => await promise(),
            number_of_workers
        );
        asyncQueue.drain = async () => {
            console.log(`finished`);
            // console.log(counter);
            resolve(generated_json);
        };

        asyncQueue.push(promises);
    });
};
