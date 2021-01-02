/**
 * Public Controller
 * all public endpoints accessible to all will be here
 */

const { logger } = require("../utils");
module.exports.routes = function ({ Services, config }) {
	return {
		"GET /test": {
			handler: async function (req, res) {
				try {
					res.json({ ok: true, message: "hello world" });
				} catch (e) {
					res.json({ ok: true, message: e.message });
					logger.error(e);
				}
			},
		},
	};
};
