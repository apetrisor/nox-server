// Third party deps
const express = require('express'),
	bodyParser = require('body-parser'),
	cookieParser = require('cookie-parser'),
	logger = require('morgan'),
	compression = require('compression'),
	favicon = require('serve-favicon'),
	path = require('path');

function WebServer(config) {
	var app = express();
	// Remove irrelevant headers
	app.set('x-powered-by', false);
	// Enable proxy for accurate ip detection
	app.enable('trust proxy');

	if (config.env == 'development') {
		// Nicely formatted JSON for dev
		app.set('json replacer', 0);
		app.set('json spaces', 4);
		// Log memory usage
		// ---------------------------------------------------------------------
		if (config.logMemoryUsage) {
			setInterval(() => {
				var m = process.memoryUsage().rss / (1024 * 1024);
				console.log(`Memory used: ${m} MB`);
			}, 30000);
		}
	} else {
		// Force SSL
		app.use(function (req, res, next) {
			// Redirect non-WWW to WWW with HTTPS
			if (req.subdomains.indexOf('www') === -1) {
				return res.redirect(301, 'https://www.' + req.hostname + req.url);
			}

			// Redirect non-HTTPS to HTTPS
			if (req.headers['x-forwarded-proto'] !== 'https') {
				return res.redirect(301, 'https://' + req.hostname + req.url);
			}

			next();
		});
	}

	// Parse Cookies
	app.use(cookieParser());
	// Use GZIP on assets
	app.use(compression());
	// Parse JSON
	app.use(bodyParser.json());
	// Parse forms
	app.use(bodyParser.urlencoded({extended: true}));
	// Parse binary
	app.use(bodyParser.raw({limit: '3000kb'}));
	// Cache favicon
	// app.use(favicon(path.resolve('./static/favicon.ico')));
	// Static files
	app.use(express.static('static'));

	this.use = (...args) => app.use(...args);
	this.use404 = f => (this.render404 = f);

	this.start = function () {
		var notFound = (req, res, next) => {
			switch (req.accepts(['html', 'json'])) {
				case 'html':
					res.status(404);
					if (this.render404) this.render404(req, res, next);
					else res.send('404');
					break;
				case 'json':
					res.status(404).json({message: 'Resource not found'});
					break;
				default:
					res.status(404).end();
			}
		};

		app.use(notFound);

		// At the end, add error routes
		app.use((err, req, res, next) => {
			if (err.status === 404) return notFound(req, res, next);

			if (!err.message) {
				if (err.status === 404) err.message = 'Resource not found';
				else err.message = 'Something really bad happened! Our engineers will fix this asap!';
			}
			if (!err.status) err.status = 500;
			res.status(err.status).json({message: err.message});
		});

		app.listen(config.port, function () {
			console.log('Server started on port ' + config.port);
		});
	};
}

module.exports.create = config => new WebServer(config);
