const { catchAPIError: catchAPI } = require('../utils/error_handlers');
const auth = require('../auth/authenticate');
const Event = require('../controllers/event');

module.exports = app => {
    // app.post('/events/get_events', catchAPI(Event.getEvents));
};
