import mongo from 'mongodb';
const {MongoClient, ObjectID} = mongo;

class DBClient {
	getId(id, type) {
		if (type === 'number') return parseFloat(id);
		if (type === 'objectid') return new ObjectID(id);
		return id;
	}

	connect(url) {
		return MongoClient.connect(url).then(client => {
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
	async search(colName, query = '', path, opts = {}) {
		let projection = opts.projection || {};
		let pageSize = parseInt(opts.pageSize) || 12;
		let {filter, index = 'default'} = opts;
		let collection = this.collection(colName);

		if (typeof query !== 'string') throw 'Search query must be a string';

		// Split query by whitespace, then remove things with less then 3 chars
		let tokens = query.split(/\s+/).filter(token => token.length > 2);

		let searchStep = {
			$search: {
				index,
				compound: {
					must: tokens.map(token => ({text: {query: token, path, fuzzy: {maxEdits: 1}}})),
				},
			},
		};

		if (filter) {
			searchStep.$search.compound.filter = Object.keys(filter).map(key => {
				if (typeof filter[key] === 'string') {
					return {text: {path: key, query: filter[key]}};
				} else {
					return {equals: {path: key, value: filter[key]}};
				}
			});
		}

		let count = await collection.aggregate([searchStep, {$count: 'count'}]).next();
		if (!count) return {data: [], pagination: {pages: 0, results: 0}};
		let totalResults = count.count;

		let totalPages = Math.ceil(totalResults / pageSize);
		let current = opts.page && parseInt(opts.page);
		if (isNaN(current) || current < 1) current = 1;
		else if (current > totalPages) current = totalPages;
		let $skip = (current - 1) * pageSize;

		let pipeline = [searchStep, {$skip}, {$limit: pageSize}];
		// Only add projection stage if necessary
		if (Object.keys(projection).length > 0) pipeline.push({$project: projection});
		let data = await collection.aggregate(pipeline).toArray();

		let pagination = {page: current, pages: totalPages, results: totalResults};
		if (current > 1) pagination.prev = current - 1;
		if (current < totalPages) pagination.next = current + 1;
		return {data, pagination};
	}

	/**
	 * Full text search via Atlas $search but without pagination
	 * @param {string} colName - collection name
	 * @param {array<string>} query - search query - can be multiple terms
	 * @param {array} path - what fields do we search in
	 * @param {object} opts - search options
	 * @param {array} opts.exclude - array of _ids for items to be excluded
	 */
	async searchBasic(colName, query, path, opts = {}) {
		let count = parseInt(opts.count) || 12;
		let {projection = {}, filter, exclude = [], index = 'default'} = opts;

		let searchStep = {
			$search: {
				index,
				compound: {
					should: query.map(token => ({text: {query: token, path, score: {constant: {value: 1}}, fuzzy: {maxEdits: 1}}})),
				},
			},
		};

		if (filter) {
			searchStep.$search.compound.filter = Object.keys(filter).map(key => ({equals: {path: key, value: filter[key]}}));
		}

		let pipeline = [searchStep];

		if (exclude.length) {
			pipeline.push({$match: {_id: {$nin: exclude}}});
		}

		pipeline.push({$limit: count});

		// Only add projection stage if necessary
		if (Object.keys(projection).length > 0) pipeline.push({$project: projection});
		return this.collection(colName).aggregate(pipeline).toArray();
	}

	/**
	 * Full text autocomplete via Atlas $search
	 * @param {string} colName - collection name
	 * @param {string} query - search query
	 * @param {string} path - what field do we search in
	 * @param {object} opts - search options
	 * @param {array} opts.exclude - array of _ids for items to be excluded
	 */
	async autocomplete(colName, query, path, opts = {}) {
		let count = parseInt(opts.count) || 10;
		let {projection = {}, filter, exclude = [], index = 'default'} = opts;

		let searchStep = {
			$search: {
				index,
				compound: {
					must: [
						{
							autocomplete: {
								query,
								path,
								fuzzy: {maxEdits: 1},
							},
						},
					],
				},
			},
		};

		if (filter) {
			searchStep.$search.compound.filter = Object.keys(filter).map(key => ({equals: {path: key, value: filter[key]}}));
		}

		let pipeline = [searchStep];

		if (exclude.length) {
			pipeline.push({$match: {_id: {$nin: exclude}}});
		}

		pipeline.push({$limit: count});

		// Only add projection stage if necessary
		if (Object.keys(projection).length > 0) pipeline.push({$project: projection});
		return this.collection(colName).aggregate(pipeline).toArray();
	}
}

export default DBClient;