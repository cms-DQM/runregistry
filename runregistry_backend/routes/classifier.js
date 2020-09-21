const Classifier = require('../controllers/classifier');
const { catchAPIError: catchAPI } = require('../utils/error_handlers');
const auth = require('../auth/authenticate');

module.exports = app => {
    // component is a special case because it needs to include the WorkspaceColumns and Workspaces:
    app.get(
        '/classifiers/component/:online_or_offline',
        catchAPI(Classifier.getComponentClassifiers)
    );

    app.get('/classifiers/:category', catchAPI(Classifier.getClassifiers));
    app.get(
        '/classifiers/:category/filter_by_component/:component',
        catchAPI(Classifier.getClassifiersFiltered)
    );
    app.put(
        '/classifiers/:category/:classifier_id',
        auth,
        catchAPI(Classifier.edit)
    );
    app.post('/classifiers/:category', auth, catchAPI(Classifier.new));
    app.delete(
        '/classifiers/:category/:classifier_id',
        auth,
        catchAPI(Classifier.delete)
    );
};
