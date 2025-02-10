const mongoose = require("mongoose");
const f = require("util").format;
const { logger } = require("../utils");

module.exports = async function (config) {
	try {
		let options = {
			...(config.mongo.replicaSet && { replicaSet: config.mongo.replicaSet }),
			minPoolSize: config.mongo.poolSize || 15,
		};
		let url = config.mongo.dnsSeedList === true ? "mongodb+srv://" : "mongodb://";
		if (true && !!config.mongo.pw) {
			const user = encodeURIComponent(config.mongo.un);
			const password = encodeURIComponent(config.mongo.pw);
			const authMechanism = config.mongo.authMechanism || "SCRAM-SHA-1";
			url = f(
				"%s%s:%s@%s?authMechanism=%s&authSource=admin",
				url,
				user,
				password,
				config.mongo.host,
				authMechanism
			);
		} else {
			url += config.mongo.host;
		}
		await mongoose.connect(url, options);
		logger.info("Mongodb Connection successful.");
	} catch (err) {
		logger.error(err.stack);
		let printableConf = config.mongo;
		delete printableConf.pw;
		logger.error("Mongodb cannot connect to: ", printableConf);
		throw err;
	}
};
