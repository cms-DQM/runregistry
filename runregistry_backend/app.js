require('dotenv').config()
const bodyParser = require('body-parser');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const models = require('./models/index');
const router = express.Router();
const { expressError } = require('./utils/error_handlers');
const routes = require('./routes/index');
const port = 9500;
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const config = require('./config/config')


function getCurrentDateString() {
  var date = new Date();
  return String(date.getFullYear()).padStart(2, '0') + '/' + String(date.getMonth()).padStart(2, '0') + '/' + String(date.getDate()).padStart(2, '0') + ' ' + String(date.getHours()).padStart(2, '0') + ':' +
    String(date.getMinutes()).padStart(2, '0') + ':' + String(date.getSeconds()).padStart(2, '0') + ']';
};

// Generic function to return logging replacement functions given a specific level
// which will be prepended to the messages.
// If the caller function is not anonymous, its name is also printed.
function getLogger(level, originalLogger = console.log) {
  return function () {
    var args = [].slice.call(arguments);
    originalLogger.apply(console.log, [getCurrentDateString(), `${level}${arguments.callee.caller && arguments.callee.caller.name ? ' (' + arguments.callee.caller.name + '):' : ":"}`].concat(args));
  }
};

// override console log to use timestamp
console.debug = console.log = getLogger("DEBUG")
console.info = getLogger("INFO")
console.warning = getLogger("WARNING")
console.error = getLogger("ERROR", console.error)

// Logging for sanity
const { database, host, port: db_port } = config[process.env.ENV];
console.info(`Using database: ${database}@${host}:${db_port}`);

models.sequelize.sync({})
  .then(async () => {
    // Initialize DB data
    if (process.env.ENV === 'development') {
      console.info('Initializing database');
      await require('./initialization/initialize')();
    }
    server.listen(port, () => {
      console.info(
        'app.js(): server listening in port', port,
        'env:', process.env.ENV);
      // Starts the cron jobs, if enabled
      const cron = require('./cron/1.get_runs');
      const dqm_gui_pinging = require('./cron_datasets/2.ping_dqm_gui');
    });

    // 100 minute timout to server
    server.timeout = 100 * 60 * 1000;

    app.use((req, res, next) => {
      req.io = io;
      next();
    });
    io.on('connect', (socket) => {
      console.info('app.js(): connection established for new client');
    });

    // For use in json_creation:
    app.use(morgan('dev'));
    app.use(cors());
    app.use(bodyParser.json({ limit: '400mb' }));
    app.use(bodyParser.urlencoded({ limit: '400mb', extended: true }));

    // Log the user
    app.use('*', (req, res, next) => {
      if (process.env.NODE_ENV === 'production') {
        console.info('app.js(): displayname = ', req.get('displayname') || req.get('id'));
      }
      next();
    });

    routes(router);
    app.use('', router);

    // We add socket.io to the request

    // Make errors appear as json to the client
    app.use(expressError);

    // Catch Application breaking error and label it here:
    process.on('uncaughtException', (err) => {
      console.log('app.js(): CRITICAL ERROR: ', err);
    });
    // Catch Promise error and label it here:
    process.on('unhandledRejection', (reason, p) => {
      console.log(
        'app.js(): Unhandled Promise Rejection at:', p, 'reason:', reason);
    });
  })
  .catch((err) => {
    console.log('app.js(): ', err);
  });
