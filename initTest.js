let { fork } = require("child_process");
var Mocha = require("mocha"),
	fs = require("fs"),
	path = require("path");

// Instantiate a Mocha instance.
var mocha = new Mocha();

var appProc = fork("./app", process.argv.length >= 3 ? [process.argv[2]] : []);

appProc.on("message", function (message) {
	if (message == "ready") {
		console.log("Server Running");

		var testDir = "./tests";

		// Add each .js file to the mocha instance
		fs.readdirSync(testDir)
			.filter(function (file) {
				// Only keep the .js files
				return file.indexOf(".js") > -1;
			})
			.forEach(function (file) {
				mocha.addFile(path.join(testDir, file));
			});

		// Run the tests.
		mocha
			.run(function (failures) {
				appProc.exitCode = failures ? 1 : 0; // exit with non-zero status if there were failures
				process.exit(failures ? 1 : 0);
			})
			.on("end", function () {
				console.log("Tests finished");
			});
	}
});

appProc.on("error", function (err) {
	console.error("Error occured on the server", err.message);
	process.exit(1);
});

appProc.on("exit", function () {
	var msg = "Server exited before tests";
	console.error(msg);
	process.exit(1);
});

appProc.on("SIGTERM", function () {
	process.exit(1);
});
