const sirv = require('sirv');
const polka = require('polka');
const send = require('@polka/send-type');
const compression = require('compression');

const Settings = require('../models/settings');

class Server {
	constructor(config) {
		this.config = config;
		this.polka = polka()
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
	}

	use(middleware) {
		return this.polka.use(middleware);
	}

	start() {
		return this.polka.listen(this.config.port, err => {
			if (err) console.error('error', err);
		});
	}
}

module.exports = Server;
