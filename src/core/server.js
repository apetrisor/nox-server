const Db = require('./db');
const webserver = require('../lib/webserver2');

function Server(config) {
	let app = webserver.create(config);

	this.start = () => {
		Db.connect(config.mongoUrl)
			.then(() => app.start())
			.catch(console.error);
	};

	this.ignoreRoutes = app.ignoreRoutes;
	this.use = (...args) => app.use(...args);
	this.stop = () => {
		Db.disconnect();
		app.server.close();
	};
}

module.exports.create = config => new Server(config);
