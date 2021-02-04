// import db from '../lib/db';
// import LRU from 'lru-cache';

var Settings = {};

// var cache = new LRU({
// 	max: 1,
// 	maxAge: 1000 * 60 * 60, // 60 min
// });

// Get one brand by url slug
Settings.get = async () => {
	let settings = cache.get('settings');
	if (!settings) {
		settings = await db.collection('settings').findOne({_id: 'settings'}, {projection: {_id: 0}});
		if (!settings) throw {status: 500, message: 'Missing site settings!'};
		cache.set('settings', settings);
	}
	return settings;
};

Settings.getForClient = settings => {
	const {filters, colors, social} = settings;
	return {filters, colors, social};
};

module.exports = Settings;
