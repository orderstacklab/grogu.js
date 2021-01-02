const fs = require("fs");

// ansi color codes
const ansiCode = {
	debug: "\x1b[36m", // blue
	info: "\x1b[32m", // green
	error: "\x1b[31m", // red
	warn: "\x1b[33m", // orangish something
	reset: "\x1b[0m",
	bold: "\x1b[1m",
};

const logger = {
	debug: function () {
		console.log(
			`${ansiCode.bold}${new Date().toISOString()}${ansiCode.reset} ${ansiCode.debug}[DEBUG] ${ansiCode.reset}`,
			...arguments
		);
	},
	info: function () {
		console.log(
			`${ansiCode.bold}${new Date().toISOString()}${ansiCode.reset} ${ansiCode.info}[INFO]  ${ansiCode.reset}`,
			...arguments
		);
	},
	error: function () {
		console.log(
			`${ansiCode.bold}${new Date().toISOString()}${ansiCode.reset} ${ansiCode.error}[ERROR] ${ansiCode.reset}`,
			...arguments
		);
	},
	warn: function () {
		console.log(
			`${ansiCode.bold}${new Date().toISOString()}${ansiCode.reset} ${ansiCode.warn}[WARN]  ${ansiCode.reset}`,
			...arguments
		);
	},
};

module.exports = {
	/**
	 * dirIterator
	 * iterates over a given directory path and returns filenames and filepaths
	 */
	dirIterator: (dir, f) => {
		let list = fs.readdirSync(dir);
		list.forEach(function (file) {
			let name = file;
			file = dir + "/" + file;
			let stat = fs.statSync(file);
			let extension = name.split(".");
			if (stat && !stat.isDirectory() && extension.length > 1) {
				name = extension[0];
				extension = extension[extension.length - 1];
				if (extension === "js") {
					f(name, file);
				}
			}
		});
	},

	/**
	 * getValidHttpMethod
	 * returns the valid http method fromthe string provided
	 */
	getValidHttpMethod: (str) => {
		if (!str) return null;
		let httpMethodRegex = /^(all|get|post|put|delete|trace|options|connect|patch|head)\s*/gi;
		let method = str.match(httpMethodRegex);
		return method && method.length ? method[method.length - 1].toLowerCase().trim() : null;
	},

	/**
	 * fatalError
	 * consoles the fatal error then shuts down the node process
	 */
	fatalError: (errMessage) => {
		logger.error(errMessage);
		process.exit(1);
	},

	/**
	 * injects dependency arguement as the last argument
	 * only works in case of functions which have original default arguments
	 * like middleware functions
	 */
	injectDependencyArgument: function (originalFunc, additionalArg) {
		let moveArguments = function (f) {
			return function () {
				var arg = Array.apply(null, arguments);
				var lastArg = arg.shift();
				return f.apply(this, arg.concat(lastArg));
			};
		};

		return moveArguments(originalFunc).bind(this, additionalArg);
	},

	logger,
};
