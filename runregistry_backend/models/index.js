const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const config = require('../config/config')[process.env.ENV || 'development'];

const { database, username, password } = config;
const sequelize = new Sequelize(database, username, password, config);

const db = {};

// Read each file in current dir, and get the DB models declarations
fs.readdirSync(__dirname)
  .filter(function (file) {
    return file.indexOf('.') !== 0 && file !== 'index.js';
  })
  .forEach(function (file) {
    const model = sequelize.import(path.join(__dirname, file));
    db[model.name] = model;
  });

// Create associations, if any (ForeignKeys?).
Object.keys(db).forEach(function (modelName) {
  if ('associate' in db[modelName]) {
    db[modelName].associate(db);
  }
})

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
