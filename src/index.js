const Server = require('./lib/server');
const DBClient = require('./lib/dbclient');

let NOX = {};

NOX.server = config => new Server(config);
NOX.db = new DBClient();

module.exports = NOX;
