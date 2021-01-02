/**
 * http.js
 * Here server level middlewares are defined
 */
let bodyParser = require("body-parser").json({ limit: "50mb" });
let compression = require("compression");
let cors = require("cors");
/* This whitelist can only filter requests from the browser clients */
var whitelist = ["http://localhost:3000"];

var corsOptions = {
	origin: function (origin, callback) {
		// console.log("HTTP Origin given = ", origin);
		if (!origin) {
			// console.log("origin undefined")
			callback(null, true);
		} else if (whitelist.indexOf(origin) !== -1) {
			callback(null, true);
		} else if (origin == null) {
			// console.log("origin null")
			callback(null, true);
		} else if (origin.indexOf("chrome-extension") >= 0) {
			callback(null, true);
		} else {
			console.log("[Not allowed by CORS] but allowed temporarily", origin);
			callback(null, true);
			// callback("Not allowed by CORS", false)
			// callback(new Error("Not allowed by CORS"), false)
		}
		return;
	},
};
let corsMiddle = cors(corsOptions);

module.exports = [bodyParser, compression(), corsMiddle];
