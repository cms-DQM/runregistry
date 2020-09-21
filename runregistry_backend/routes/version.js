const { catchAPIError: catchAPI } = require('../utils/error_handlers');
const auth = require('../auth/authenticate');
const Version = require('../controllers/version');

module.exports = app => {
    app.post('/versions/get_versions', catchAPI(Version.getVersions));
};
