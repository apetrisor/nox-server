const Db = require('./db');
const webserver = require('../lib/webserver2');
const Settings = require('../models/settings');

function Server(config) {
	let app = webserver.create(config);
	// Get site settings and append to req
	app.use((req, res, next) => {
		Settings.get()
			.then(settings => {
				req.settings = settings;
				req.clientSettings = Settings.getForClient(settings);
				next();
			})
			.catch(next);
	});

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
