/**
 * conf.js
 * this is the main config file and can be accessed through the "config" dependency
 * which is injected in both controllers and middlewares
 */
module.exports = {
	mongo: {
		host: process.env.MONGODB_HOST,
		dnsSeedList: process.env.MONGODB_DNS_SEED_LIST == "true" ? true : false,
	},
};
