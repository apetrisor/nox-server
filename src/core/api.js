let Api = {};

Api.wrap = handler => {
	return async function get(req, res) {
		try {
			let data = await handler(req);
			res.send(200, data);
		} catch (err) {
			console.error(err);
			res.send(err.status || 500, err);
		}
	};
};

module.exports = Api;
