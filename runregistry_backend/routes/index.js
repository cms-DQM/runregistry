const classifier = require('./classifier');
const run = require('./run');
const dataset = require('./dataset');
const classifier_playground = require('./classifier_playground');
const lumisection = require('./lumisection');
const workspace = require('./workspace');
const datasets_accepted = require('./datasets_accepted');
const cycle = require('./cycle');
const dc_tools = require('./dc_tools');
const json = require('./json');
const visualization = require('./visualization');
const event = require('./event');
const version = require('./version');

module.exports = function (router) {
  classifier(router);
  run(router);
  dataset(router);
  classifier_playground(router);
  lumisection(router);
  workspace(router);
  datasets_accepted(router);
  cycle(router);
  dc_tools(router);
  json(router);
  visualization(router);
  event(router);
  version(router);
};
