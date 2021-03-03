let Filters = {};

// Makes a db query from a filters array and a queryString object
Filters.makeQuery = (filters, query, validate = true) => {
	let q = {};

	if (!Array.isArray(filters)) return q;

	filters.forEach(filter => {
		let value = query[filter.name];
		if (value) {
			if (filter.type === 'toggle') {
				if (value === '1') q[filter.name] = true;
				else if (value === '0') q[filter.name] = false;
			} else {
				let options = filter.options;
				// If filter has parent concatenate all parent options
				if (filter.parent) {
					options = [].concat(...Object.values(options));
				}

				if (typeof value === 'string') {
					if (!validate || options.indexOf(value) !== -1) q[filter.name] = value;
				} else if (Array.isArray(value)) {
					if (validate) value = value.filter(val => options.indexOf(val) !== -1);
					if (value.length === 1) {
						q[filter.name] = value[0];
					} else if (value.length > 1) {
						if (filter.selection === 'inclusive') q[filter.name] = {$in: value};
						else q[filter.name] = {$all: value};
					}
				}
			}
		}
	});

	return q;
};

module.exports = Filters;
