const {SitemapStream, streamToPromise} = require('sitemap');

class Sitemap {
	constructor(hostname) {
		this.stream = new SitemapStream({
			hostname,
			xmlns: {
				news: false,
				video: false,
			},
		});
	}

	add(pages) {
		pages.forEach(page => {
			let opts = {
				changefreq: 'weekly',
			};
			if (typeof page === 'object') opts = {...opts, ...page};
			else opts.url = page;
			this.stream.write(opts);
		});
	}

	render() {
		this.stream.end();
		return streamToPromise(this.stream);
	}
}

module.exports.create = hostname => new Sitemap(hostname);
