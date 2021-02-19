const Models = require('../core/models');

let Settings = Models.create('settings', {
	get: {
		method: 'get',
		filter: {_id: 'settings'},
		cache: {count: 1, time: 60},
	},
});

Settings.getForClient = settings => {
	const {filters, colors, social, homePage} = settings;
	return {filters, colors, social, homePage};
};

module.exports = Settings;
