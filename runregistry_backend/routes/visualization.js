const { catchAPIError: catchAPI } = require('../utils/error_handlers');
const auth = require('../auth/authenticate');
const Visualization = require('../controllers/visualization_endpoint');

module.exports = app => {
    app.post(
        '/visualization/generate',
        catchAPI(Visualization.get_visualization_endpoint)
    );
};
