const sirv = require('sirv');
const polka = require('polka');
const send = require('@polka/send-type');
const compression = require('compression');

const db = require('./db');
const Settings = require('../models/settings');

let config;
let app;

let Server = {
	init: cfg => {
		config = cfg;
		app = polka()
			// Add support for res.send
			.use((req, res, next) => {
				res.send = send.bind(null, res);
				next();
			})
			// Get site settings and append to req
			.use(async (req, res, next) => {
				try {
					req.settings = await Settings.get();
					req.clientSettings = Settings.getForClient(req.settings);
					next();
				} catch (e) {
					next(e);
				}
			})
			.use(compression({threshold: 0}))
			.use(sirv('static', {dev: config.env === 'development'}));

		return Server;
	},
	start: () => {
		db.connect(config.mongoUrl)
			.then(() => {
				app.listen(config.port, err => {
					if (err) console.error(err);
				});
			})
			.catch(console.error);
	},
	use: middleware => {
		return app.use(middleware);
	},
	stop: () => {
		db.disconnect();
		app.server.close();
	},
};

module.exports = cfg => Server.init(cfg);
