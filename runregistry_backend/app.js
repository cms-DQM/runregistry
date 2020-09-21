const bodyParser = require('body-parser');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const models = require('./models/index');
// Add timestamps to logs:
require('console-stamp')(console);
const { expressError } = require('./utils/error_handlers');
const routes = require('./routes/index');
const port = 9500;

const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
models.sequelize
  .sync({})
  .then(async () => {
    // Initialize DB data
    // await require('./initialization/initialize')();
    server.listen(port, () => {
      console.log(`server listening in port ${port}`);
      // const cron = require('./cron/1.get_runs'); // (for testing)
      if (process.env.ENV !== 'development') {
        const cron = require('./cron/1.get_runs');
      }
      // const dqm_gui_pinging = require('./cron_datasets/2.ping_dqm_gui');
      // const dbs_pinging = require('./cron_datasets/2.ping_dbs');
    });

    // 100 minute timout to server
    server.timeout = 100 * 60 * 1000;

    app.use((req, res, next) => {
      req.io = io;
      next();
    });
    io.on('connect', (socket) => {
      console.log('connection established for new client');
    });

    // For use in json_creation:
    app.use(morgan('dev'));
    app.use(cors());
    app.use(bodyParser.json({ limit: '400mb' }));
    app.use(bodyParser.urlencoded({ limit: '400mb', extended: true }));

    // Log the user
    app.use('*', (req, res, next) => {
      if (process.env.NODE_ENV === 'production') {
        console.log(req.get('displayname'));
      }
      next();
    });
    routes(app);

    // We add socket.io to the request

    // Make errors appear as json to the client
    app.use(expressError);

    // Catch Application breaking error and label it here:
    process.on('uncaughtException', (err) => {
      console.log('CRITICAL ERROR: ', err);
    });
    // Catch Promise error and label it here:
    process.on('unhandledRejection', (reason, p) => {
      console.log('Unhandled Promise Rejection at:', p, 'reason:', reason);
    });
  })
  .catch((err) => {
    console.log(err);
  });
