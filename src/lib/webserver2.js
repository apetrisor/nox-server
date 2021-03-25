const sirv = require('sirv');
const polka = require('polka');
const send = require('@polka/send-type');
const compression = require('compression');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const axios = require('axios');
// const favicon = require('serve-favicon');
// const path = require('path');

function WebServer(config) {
	var app = polka();

	if (config.env == 'development') {
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
		// app.use((req, res, next) => {
		// 	// Redirect non-WWW to WWW with HTTPS
		// 	if (req.subdomains.indexOf('www') === -1) {
		// 		return res.redirect(301, 'https://www.' + req.hostname + req.url);
		// 	}
		// 	// Redirect non-HTTPS to HTTPS
		// 	if (req.headers['x-forwarded-proto'] !== 'https') {
		// 		return res.redirect(301, 'https://' + req.hostname + req.url);
		// 	}
		// 	next();
		// });
	}

	app.use((req, res, next) => {
		// Add support for res.send
		res.send = send.bind(null, res);
		// Add cloudflare countrycode if available
		req.countryCode = req.headers['CF-IPCountry'];
		next();
	});

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
	// Sitemap
	app.get('/sitemap.xml', async (req, res, next) => {
		axios({method: 'GET', url: config.assetsUrl + 'sitemap.xml', responseType: 'stream'}).then(({data}) => data.pipe(res));
	});
	// Static files
	app.use(sirv('static', {dev: config.env === 'development'}));

	this.ignoreRoutes = ['/static', 'sitemap.xml'];
	this.use = (...args) => app.use(...args);

	this.start = function () {
		app.listen(config.port, function () {
			console.log('Server started on port ' + config.port);
		});
	};
}

module.exports.create = config => new WebServer(config);
