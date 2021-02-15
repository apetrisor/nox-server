const Db = require('./db');
const LRU = require('lru-cache');

const getProjection = (proj = []) => Object.fromEntries(proj.map(key => [key, 1]));
const getCache = config => {
	if (config.cache && !config.stats) {
		// Default max items 100
		let max = config.cache.count || 100;
		// Default age 1 hour
		let maxAge = 1000 * 60 * (config.cache.time || 60);
		let cache = new LRU({max, maxAge});
		return {
			get: async opts => {
				let cacheKey = JSON.stringify(opts.key);
				let data = cache.get(cacheKey);
				if (!data) {
					data = await opts.fetch();
					cache.set(cacheKey, data);
				}
				return data;
			},
		};
	}
};

const Methods = {
	get: (collection, config) => {
		let projection = getProjection(config.projection);
		let cache = getCache(config);
		return async function (query) {
			let q = {...query, ...config.query};
			let item;
			if (config.stats) {
				item = await Db.collection(collection).findOneAndUpdate(q, {$inc: {'stats.totalViews': 1, 'stats.monthlyViews': 1, 'stats.weeklyViews': 1}}, {projection});
				item = item.value;
			} else {
				let fetch = () => Db.collection(collection).findOne(q, {projection});
				if (cache) item = await cache.get({key: q, fetch});
				else item = await fetch();
			}

			if (!item) return null;

			if (config.lookup) {
				for (var key in config.lookup) {
					let call = config.lookup[key];
					let data = await call(item[key]);
					item[key] = data;
				}
			}

			if (config.process) {
				item = await config.process(item);
			}

			return item;
		};
	},
	paginate: (collection, config) => {
		let projection = getProjection(config.projection);
		return async (query, page) => {
			let {pageSize} = config;
			let q = {...query, ...config.query};
			let data = await Db.paginate(collection, q, {page, projection, pageSize});

			if (config.process) {
				data = await config.process(data);
			}

			return data;
		};
	},
	search: (collection, config) => {
		let projection = getProjection(config.projection);
		return async (query, page) => {
			let {path, pageSize} = config;
			if (!path || !path.length) throw 'Missing path for search query';
			let data = await Db.search(collection, query, path, {page, projection, pageSize});

			if (config.process) {
				data = await config.process(data);
			}

			return data;
		};
	},
	getMany: (collection, config) => {
		let projection = getProjection(config.projection);
		let cache = getCache(config);
		return async query => {
			let {count = 12, sort} = config;
			let q = {...query, ...config.query};

			let fetch = () => Db.collection(collection).find(q, {projection}).limit(count).sort(sort).toArray();
			let item;
			if (cache) item = await cache.get({key: q, fetch});
			else item = await fetch();

			if (config.process) {
				item = await config.process(item);
			}

			return item;
		};
	},
};

const Models = {
	create: (collection, config) => {
		let model = {};
		for (var key in config) {
			let cfg = config[key];
			let method = Methods[cfg.method];
			model[key] = method(collection, cfg);
		}
		return model;
	},
};

module.exports = Models;
