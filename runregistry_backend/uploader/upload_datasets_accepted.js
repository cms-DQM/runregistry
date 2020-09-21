const axios = require('axios');
const { API_URL } = require('../config/config')['development'];
const csv = require('csvtojson');
const csvFilePath = `${__dirname}/gui_triggers.csv`;

(async () => {
    const promiseSerial = funcs =>
        funcs.reduce(
            (promise, func) =>
                promise.then(result =>
                    func().then(Array.prototype.concat.bind(result))
                ),
            Promise.resolve([])
        );

    const json = await csv().fromFile(csvFilePath);
    const funcs = json.map(dataset_accepted => () => {
        const {
            DGT_ID,
            DGT_DATASET_NAME,
            DGT_DATASET_REGEX,
            DGT_ORDER_NUM,
            DGT_RUN_NUMBER_FROM,
            DGT_ENABLED,
            DGT_RUN_CLASS,
            DGT_RUN_NUMBER_TO,
            DGT_RUN_CLASS_TABLE,
            DGT_DATASET_NAME_HASH,
            DGT_DGS_ID
        } = dataset_accepted;

        const new_dataset_accepted = {
            name: DGT_DATASET_NAME,
            regexp: DGT_DATASET_REGEX,
            enabled: DGT_ENABLED,
            run_from: DGT_RUN_NUMBER_FROM,
            run_to: DGT_RUN_NUMBER_TO,
            class: DGT_RUN_CLASS,
            enabled: true
        };

        return axios
            .post(`${API_URL}/datasets_accepted`, new_dataset_accepted, {
                headers: { email: 'f.e@cern.ch' }
            })
            .catch(err => {
                console.log(err);
            });
    });
    promiseSerial(funcs);
})();
