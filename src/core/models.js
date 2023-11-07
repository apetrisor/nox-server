
import Db from './db';
import {LRUCache} from 'lru-cache';

const getProjection = (proj = []) => Object.fromEntries(proj.map(key => [key, 1]));
const getCache = config => {
	if (config.cache && !config.stats) {
		// Default max items 100
		let max = config.cache.count || 100;
		// Default age 1 hour
		let ttl = 1000 * 60 * (config.cache.time || 60);
		let cache = new LRUCache({max, ttl});
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
		return async query => {
			let q = {...query, ...config.filter};
			let item;
			if (config.stats) {
				item = await Db.collection(collection).findOneAndUpdate(q, {$inc: {'stats.totalViews': 1, 'stats.monthlyViews': 1, 'stats.weeklyViews': 1}}, {projection});
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
		return async (query, page, opts = {}) => {
			let {pageSize} = config;
			let q = {...query, ...config.filter};
			let data = await Db.paginate(collection, q, {page, projection, pageSize, ...opts});

			if (config.process) {
				data = await config.process(data);
			}

			return data;
		};
	},
	search: (collection, config) => {
		let projection = getProjection(config.projection);
		return async (query, page, opts = {}) => {
			let {path, pageSize, filter, index} = config;
			if (!path || !path.length) throw 'Missing path for search query';
			let data = await Db.search(collection, query, path, {index, filter, projection, page, pageSize});

			if (config.process) {
				data = await config.process(data);
			}

			return data;
		};
	},
	searchBasic: (collection, config) => {
		let projection = getProjection(config.projection);
		return async (query, opts = {}) => {
			let {exclude} = opts;
			let {path, count, filter, index} = config;
			if (!path || !path.length) throw 'Missing path for search query';

			if (!Array.isArray(query)) {
				query = [query];
			}
			query = query.filter(item => !!item && typeof item === 'string');

			let data = await Db.searchBasic(collection, query, path, {index, filter, exclude, projection, count});

			if (config.process) {
				data = await config.process(data);
			}

			return data;
		};
	},
	autocomplete: (collection, config) => {
		let projection = getProjection(config.projection);
		return async (query, opts = {}) => {
			if (!query) return [];

			let {exclude} = opts;
			let {path, count, filter, index} = config;
			if (!path || !path.length) throw 'Missing path for search query';

			let data = await Db.autocomplete(collection, query, path, {index, filter, exclude, projection, count});

			if (config.process) {
				data = await config.process(data);
			}

			return data;
		};
	},
	getMany: (collection, config) => {
		let projection = getProjection(config.projection);
		let cache = getCache(config);
		return async (query, opts) => {
			let {count = 12, sort} = {...config, ...opts};
			let q = {...query, ...config.filter};

			let fetch = () => Db.collection(collection).find(q, {projection}).limit(count).sort(sort).toArray();
			let items;
			if (cache) items = await cache.get({key: q, fetch});
			else items = await fetch();

			if (config.process) {
				items = await config.process(items);
			}

			return items;
		};
	},
	count: (collection, config) => {
		let cache = getCache(config);
		return async query => {
			let q = {...query, ...config.filter};

			let fetch = () => Db.collection(collection).countDocuments(q);
			let count;
			if (cache) count = await cache.get({key: q, fetch});
			else count = await fetch();

			if (config.process) {
				count = await config.process(count);
			}

			return count;
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

export default Models;
