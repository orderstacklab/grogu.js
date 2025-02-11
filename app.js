const express = require("express");
const fs = require("fs");
const app = express();
const { logger, fatalError } = require("./utils");
const CRUDGenerator = require("./utils/crudGenerator");
const SwaggerGenerator = require("./utils/swaggerGenerator");

const path = require("path");

// Root directory path
const rootDir = path.dirname(require.main.filename);

// Initialize CRUD operations
const crudGenerator = new CRUDGenerator(
	path.join(__dirname, "models"),
	path.join(__dirname, "controllers"),
	path.join(__dirname, "services")
);

// require dotenv for .env variable injection
if (process.argv.length >= 3) {
	let ENV = process.argv[2];
	if (!fs.existsSync(rootDir + "/.env." + ENV)) {
		fatalError(`.env.${ENV} environment not provided`);
	}
	require("dotenv").config({
		path: rootDir + "/.env." + ENV,
	});
} else {
	if (!fs.existsSync(rootDir + "/.env")) {
		fatalError("Default .env file environment not provided");
	}
	require("dotenv").config({ path: rootDir + "/.env" });
}

// Controller dir path
const controllersDir = rootDir + "/controllers";
// Services dir path
const servicesDir = rootDir + "/services";
// Middleware dir path
const middlewaresDir = rootDir + "/middlewares";
// Config dir path
const configDir = rootDir + "/config";

const utils = require("./utils");
const mongooseConnector = require("./utils/mongooseConnector");
const port = process.env.PORT || 3000;

// prettier-ignore
const apiVersionConfig = fs.existsSync(configDir + "/apiVersions.js") 
	? require(configDir + "/apiVersions.js")
	: {
		default: "v1.0",
		allowedVersions: ["v1.0"],
	};
if (!apiVersionConfig.default || !apiVersionConfig.allowedVersions) {
	utils.fatalError("apiVersion config is invalid please check config/apiVersions.js");
}

// function to load the app
const load = async function () {
	try {
		await crudGenerator.initialize();
		console.log("CRUD operations initialized successfully");
	} catch (error) {
		console.error("Failed to initialize CRUD operations:", error);
		process.exit(1);
	}

	// Initialize Swagger documentation
	const swaggerGenerator = new SwaggerGenerator(app);
	await swaggerGenerator.initialize(path.join(__dirname, "models"));

	// Services and Middleware objects to store all the required functions
	const Services = {};
	const Middlewares = {};

	// Load config which will be a dependency injection
	const config = { CONSTANTS: require(configDir + "/constants"), ...require(configDir + "/conf"), rootDir };

	// Load all services by iterating and requiring files inside /services
	utils.dirIterator(servicesDir, function (filename, filepath) {
		let serviceName = filename.charAt(0).toUpperCase() + filename.slice(1);
		Services[serviceName] = require(filepath);
	});

	// load async dependencies in services if any and inject the config dependency
	for (let serviceName in Services) {
		Services[serviceName] = await Services[serviceName]({ config: config, Services });
	}

	// Load all middlewares by iterating and requiring files inside /middlewares
	utils.dirIterator(middlewaresDir, function (filename, filepath) {
		Middlewares[filename] = require(filepath);
	});

	// Load all server level middlewares as in the topmost level of middlewares only if /config/http.js exists
	if (fs.existsSync(configDir + "/http.js")) {
		let httpMiddlewares = require(configDir + "/http");
		httpMiddlewares.forEach((item) => {
			app.use(item);
		});
	}

	// Loading all controllers in a express Router
	// Iterate over all the files in /controllers
	utils.dirIterator(controllersDir, function (filename, filepath) {
		let expressRouter = express.Router();
		let controllerConfig = require(filepath);

		// The filename in class case is the base route path
		let baseRoute = filename.charAt(0).toUpperCase() + filename.slice(1);

		// Get subroute routes and inject the Services and config dependency
		let routeConfig = controllerConfig.routes({ Services, config: config });

		// For each sub route defined in a controller load it in the express router with appropriate middlewares
		for (let subRouteName in routeConfig) {
			let subRouteConfig = routeConfig[subRouteName];

			// If localMiddlewares dont exist then keep default no middlewares
			subRouteConfig.localMiddlewares = subRouteConfig.localMiddlewares || [];

			let keyMethodName = utils.getValidHttpMethod(subRouteName);
			let methodName = utils.getValidHttpMethod(subRouteConfig.method);

			if (keyMethodName && methodName)
				fatalError(`Dual HTTP method definition at controllers/${filename} at route: "${subRouteName}"`);

			if (keyMethodName) {
				let routeIndex = subRouteName.indexOf("/");
				subRouteName = subRouteName.substring(routeIndex);
				methodName = keyMethodName;
			}

			if (!methodName && !keyMethodName) {
				fatalError(
					`Invalid HTTP method: "${subRouteConfig.method}" at controllers/${filename} at route: "${subRouteName}"`
				);
			}

			// If route is disabled by default all routes are enabled
			if (subRouteConfig.enabled === false) {
				logger.warn(
					`Disabled endpoint HTTP method: "${methodName.toUpperCase()}" at controllers/${filename} at route: "${subRouteName}"`
				);
				logger.info("_______________________________________________________");
				continue;
			}

			if (!subRouteConfig.version) {
				subRouteName = "/" + apiVersionConfig.default + subRouteName;
			} else {
				if (!apiVersionConfig.allowedVersions.includes(subRouteConfig.version)) {
					fatalError(
						`Invalid api version: "${subRouteConfig.version}" at controllers/${filename} at route: "${subRouteName}"`
					);
				} else {
					subRouteName = "/" + subRouteConfig.version + subRouteName;
				}
			}

			// here expressRouter.[methodName]("/",middlewares,handler) is happening automatically
			expressRouter[methodName](
				subRouteName,
				// get the actual middleware functions from the name references in the config
				subRouteConfig.localMiddlewares.map((e) => {
					if (!Middlewares[e]) {
						// if a middleware name reference does not exist
						utils.fatalError(
							`Invalid middleware name: "${e}" at controllers/${filename} at route: "${subRouteName}"`
						);
					}
					// inject Services and config as a dependency to middleware
					return utils.injectDependencyArgument(Middlewares[e], { Services, config: config });
				}),
				subRouteConfig.handler
			);

			logger.info(`Added | \t ${methodName.toUpperCase()}  /${baseRoute}${subRouteName}`);
			logger.info("_______________________________________________________");
		}

		// attach global middlewares to the baseRoute
		controllerConfig.globalMiddlewares &&
			controllerConfig.globalMiddlewares.forEach((middlewareName) => {
				if (!Middlewares[middlewareName]) {
					// if a middleware name reference does not exist
					utils.fatalError(`Invalid middleware name: "${middlewareName}" at controllers/${filename}`);
				}
				// inject Services and config as a dependency to middleware
				app.use(
					"/" + baseRoute,
					utils.injectDependencyArgument(Middlewares[middlewareName], { Services, config: config })
				);
			});

		// attach router to the baseRoute through app
		app.use("/" + baseRoute, expressRouter);
	});

	// mongoose connector
	await mongooseConnector({ mongo: config.mongo });
};

process.on("unhandledRejection", (error) => {
	console.log("unhandledRejection : ", error);
});

load()
	.then(() => {
		// start listening
		app.listen(port, function () {
			logger.info(`Listening on ${port}`);
			if (process.send) {
				process.send("ready");
			}
		});
	})
	.catch((error) => {
		console.log("Error while intializing : ", error);
	});
