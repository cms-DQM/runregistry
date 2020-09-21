const { catchAPIError: catchAPI } = require('../utils/error_handlers');
const requireAuth = require('../auth/authenticate');
const Permission = require('../controllers/permission');

module.exports = app => {
    app.get('/permissions', catchAPI(Permission.getAll));
    app.put('/permissions', auth, catchAPI(Permission.edit));
    app.post('/permissions/add_egroup', auth, catchAPI(Permission.addEgroup));
    app.delete(
        '/permission/:egroup_id',
        auth,
        catchAPI(Permission.deleteEgroup)
    );
};
