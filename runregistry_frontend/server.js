require('dotenv').config()
const express = require('express');
const next = require('next');


const qs = require('qs');
const { NODE_ENV, ENV } = process.env;
const dev = typeof NODE_ENV === 'undefined' || NODE_ENV === 'development';
const app = next({ dev });

const handle = app.getRequestHandler();
const http_port = process.env.PORT || 7001;
const root_url_prefix = '';


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

app.prepare().then(() => {
  const server = express();
  // We set depth of query parser to allow complicated url filters on the table
  // (for bookmarkability)
  server.set('query parser', function (str) {
    return qs.parse(str, { depth: 50 });
  });
  // const router = express.Router();

  // Redirects primary url to runs/all
  server.get('/', (req, res) => {
    res.redirect(`${root_url_prefix}/online/global`);
  });
  server.get('/online', (req, res) => {
    res.redirect(`${root_url_prefix}/online/global`);
  });
  server.get('/offline', (req, res) => {
    res.redirect(`${root_url_prefix}/offline/datasets/global`);
  });
  server.get('/ml', (req, res) => {
    res.redirect(`${root_url_prefix}/ml/datasets/global`);
  });

  // online:
  server.get('/online/:workspace', (req, res) => {
    console.log(req.headers, req.params, req.query);
    req.params.type = 'online';
    const params = { ...req.headers, ...req.params, filters: req.query };
    app.render(req, res, `/online`, params);
  });

  // offline:
  // section can be either datasets or cycles
  server.get('/offline/:section/:workspace', (req, res) => {
    console.log(req.headers, req.params, req.query);
    req.params.type = 'offline';
    const params = { ...req.headers, ...req.params, filters: req.query };
    app.render(req, res, `/offline`, params);
  });

  server.get('/ml/:section/:workspace', (req, res) => {
    console.log(req.headers, req.params, req.query);
    req.params.type = 'ml';
    const params = { ...req.headers, ...req.params, filters: req.query };
    app.render(req, res, `/ml`, params);
  });

  // json:
  server.get('/json', (req, res) => {
    console.log(req.headers, req.params, req.query);
    req.params.type = 'json';
    const params = { ...req.headers, ...req.params, filters: req.query };
    app.render(req, res, `/json`, params);
  });

  server.get('/json_portal', (req, res) => {
    console.log(req.headers, req.params, req.query);
    req.params.type = 'json_portal';
    const params = { ...req.headers, ...req.params, filters: req.query };
    app.render(req, res, `/json_portal`, params);
  });

  // log:
  server.get('/log', (req, res) => {
    console.log(req.headers, req.params, req.query);
    req.params.type = 'log';
    const params = { ...req.headers, ...req.params, filters: req.query };
    app.render(req, res, `/log`, params);
  });
  server.get('*', (req, res) => {
    console.log(req.headers, req.params, req.query);
    return handle(req, res);
  });

  server.listen(http_port, (err) => {
    if (err) throw err;
    console.log(`> HTTP listening in port ${http_port}`);
  });
});
