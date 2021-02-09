var mongodb = require('mongodb'),
	MongoClient = mongodb.MongoClient,
	ObjectID = mongodb.ObjectID,
	nanoid = require('nanoid').nanoid;

class DBClient {
	getId(id, type) {
		if (type === 'number') return parseFloat(id);
		if (type === 'objectid') return new ObjectID(id);
		return id;
	}

	async generateId(collection) {
		var type = collection && collection.settings.idType;
		if (type === 'number') {
			let counter = await this.collection('counters').findOneAndUpdate({_id: collection.name}, {$inc: {seq: 1}}, {returnOriginal: false});
			return counter.value.seq;
		}
		if (type === 'objectid') return new ObjectID();
		return nanoid();
	}

	connect(url) {
		return MongoClient.connect(url, {useNewUrlParser: true, useUnifiedTopology: true}).then(client => {
			this.client = client;
			this.db = client.db();
		});
	}

	disconnect() {
		this.client.close();
	}

	collection(name) {
		return this.db.collection(name);
	}

	async paginate(colName, query, opts) {
		var projection = (opts && opts.projection) || {},
			pageSize = (opts && parseInt(opts.pageSize)) || 50,
			sort = (opts && opts.sort) || {createdAt: -1};

		var collection = this.collection(colName);
		var totalResults = await collection.countDocuments(query);
		if (!totalResults) return {data: [], pagination: {pages: 0, results: 0}};

		var totalPages = Math.ceil(totalResults / pageSize);

		var current = opts.page && parseInt(opts.page);
		if (isNaN(current) || current < 1) current = 1;
		else if (current > totalPages) current = totalPages;

		var skip = (current - 1) * pageSize;
		var data = await collection.find(query, {projection}).sort(sort).skip(skip).limit(pageSize).toArray();

		var pagination = {page: current, pages: totalPages, results: totalResults};
		if (current > 1) pagination.prev = current - 1;
		if (current < totalPages) pagination.next = current + 1;
		return {data, pagination};
	}

	// Full text search via the MongoDB Atlas $search aggregation pipeline
	async search(colName, query, path, opts = {}) {
		let projection = opts.projection || {};
		let pageSize = parseInt(opts.pageSize) || 12;
		let collection = this.collection(colName);

		// Split query by whitespace, then remove things with less then 3 chars
		let tokens = query.split(/\s+/).filter(token => token.length > 2);

		let searchStep = {
			$search: {
				compound: {
					must: tokens.map(token => ({text: {query: token, path, fuzzy: {maxEdits: 1}}})),
					// TODO - make this part of API
					filter: {equals: {path: 'enabled', value: true}},
				},
			},
		};

		let count = await collection.aggregate([searchStep, {$count: 'count'}]).next();
		if (!count) return {data: [], pagination: {pages: 0, results: 0}};
		let totalResults = count.count;

		let totalPages = Math.ceil(totalResults / pageSize);
		let current = opts.page && parseInt(opts.page);
		if (isNaN(current) || current < 1) current = 1;
		else if (current > totalPages) current = totalPages;
		let $skip = (current - 1) * pageSize;

		let data = await collection.aggregate([searchStep, {$skip}, {$limit: pageSize}, {$project: projection}]).toArray();

		let pagination = {page: current, pages: totalPages, results: totalResults};
		if (current > 1) pagination.prev = current - 1;
		if (current < totalPages) pagination.next = current + 1;
		return {data, pagination};
	}
}

module.exports = DBClient;
