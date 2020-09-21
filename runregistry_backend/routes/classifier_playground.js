const ClassifierPlayground = require('../controllers/classifier_playground');
const { catchAPIError: catchAPI } = require('../utils/error_handlers');

module.exports = app => {
    app.get(
        '/classifier_playground/run_info/:run_number',
        catchAPI(ClassifierPlayground.getRunInfo)
    );
    app.post(
        '/classifier_playground',
        catchAPI(ClassifierPlayground.testClassifier)
    );
    app.post(
        '/classifier_playground_arbitrary',
        catchAPI(ClassifierPlayground.testArbitraryClassifier)
    );

    app.post(
        '/classifier_playground/test_lumisection',
        catchAPI(ClassifierPlayground.testLumisection)
    );
};
