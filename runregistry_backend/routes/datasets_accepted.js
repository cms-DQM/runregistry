const { catchAPIError: catchAPI } = require('../utils/error_handlers');
const auth = require('../auth/authenticate');
const DatasetsAccepted = require('../controllers/datasets_accepted');

module.exports = app => {
    app.get('/datasets_accepted', catchAPI(DatasetsAccepted.getAll));
    app.get(
        '/datasets_accepted/:class',
        catchAPI(DatasetsAccepted.getAllByClass)
    );
    app.post('/datasets_accepted', catchAPI(DatasetsAccepted.new));
    app.put(
        '/datasets_accepted/:id_dataset_accepted',
        auth,
        catchAPI(DatasetsAccepted.edit)
    );
    app.delete(
        '/datasets_accepted/:id_dataset_accepted',
        auth,
        catchAPI(DatasetsAccepted.delete)
    );
};
