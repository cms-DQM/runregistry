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

module.exports = function(app) {
    classifier(app);
    run(app);
    dataset(app);
    classifier_playground(app);
    lumisection(app);
    workspace(app);
    datasets_accepted(app);
    cycle(app);
    dc_tools(app);
    json(app);
    visualization(app);
    event(app);
    version(app);
};
