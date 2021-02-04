const Server = require('./core/server');
const db = require('./core/db');

let NOX = {};

NOX.server = config => Server(config);
NOX.db = db;

module.exports = NOX;
