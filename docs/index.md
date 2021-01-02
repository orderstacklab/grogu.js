# Framework Documentation

<!-- This contains documentation for the express based custom framework that has been written. -->

# Concepts and Usage

---

## Controllers

The quickest way to get started writing a controller files is to just create `.js` files inside `/controllers`. A controller file is a PascalCased file, which exports routes and globalMiddlewares. For example, a `User` Controller could be created at `controllers/User.js` file containing:

```js
// if globalMiddlewares not exported default value will be empty array i.e no middlewares
module.exports.globalMiddlewares = ["middlewareA"];

module.exports.routes = function ({ Services, config }) {
	return {
		"/hello": {
			method: "get", // http method definition
			// version: "v2.2", // specifies the api version if not specified default version will be v1.0
			handler: async (req, res) => {
				// request handler
				res.json({ message: await Services.UserService.iDoSomething() });
			},
			enabled: true, // optional parameter by default will be true
			localMiddlewares: ["middlewareB"], // route specific middlewares defined here if not defined then no middeware used
		},

		/*
		 * alternatively you can define the route and method in the string key itself as shown below
		 * in this case "method" property is to be skipped
		 * if both exist then it will throw an error
		 */
		"POST /hello": {
			version: "v2.2", // specifies the api version if not specified default version will be v1.0
			handler: async (req, res) => {
				// request handler
				res.json({ message: await Services.UserService.iDoSomething() });
			},
			enabled: true, // optional parameter by default will be true
			localMiddlewares: ["middlewareB"], // route specific middlewares defined here if not defined then no middeware used
		},
	};
};
```

`globalMiddlewares` is a list of middleware names defined in `/middlewares` to be applied to all the routes defined inside `User.js` see reference [Middlewares](#Middlewares) <br>
`routes` is a function which returns a key/value pair of routes and their definition and receives [Services](#Services) and [config](#config) as dependency arguments for usage inside express request handler functions.

The above example code leads to the creation of route as `GET` on `localhost:<PORT>/User/v1.0/hello` and `POST` on `localhost:<PORT>/User/v2.2/hello`

---

## Services

Services are functions which help divide and selectively use the core logic of the app. These service functions can be created by defining `.js` file inside `/services`. A service file is a PascalCased file, which exportsa function with inturn returns an object with all the functions related to that service. For example, a `UserService` could be created at `services/UserService.js` file containing:

```js
module.exports = async function ({ config, Services }) {
	return {
		iDoSomething: async function () {
			return "hello world";
		},
	};
};
```

Similar to routes in controller the function exported from inside the service file receives [config](#config) and [Services](#Services) as the dependency so as to enable cross usage and sharing of service functions between files.

These functions defined inside each service file then can be called directly inside as seen in [Controllers](#Controllers) and [Middlewares](#Middlewares) using the syntax as `Services.UserService.iDoSomething`

---

## Middlewares

Middlewares are express middlewares to be applied on routes definitions. These middlewares are defined as `.js` files in `/middlewares`. For example a middleware named `checkSomething` could be created as `middlewares/checkSomething.js`

```js
module.exports = async function (req, res, next, { Services, config }) {
	next();
};
```

Here the express middleware function also has a dependency injection of [config](#config) and [Services](#Services) for usage inside the middleware function.

---

## config

This is used for using config variables, constants directly inside [Services](#Services), [Middlewares](#Middlewares) and [Controllers](#Controllers). The root config file can be found at `config/conf.js` containing:

```js
module.exports = {
	aws: {
		key: process.env.AWS_KEY,
		secret: process.env.AWS_SECRET,
		ses: {
			from: {
				default: "noreply@abc.in>",
			},
			region: "us-west-2",
		},
	},
};
```

and similarly constants are defined inside `config/constants` containing:

```js
module.exports = {
	DEFAULT_NULL_VALUE: "_NULL_",
};
```

this config and constants are coupled together can be used directly using syntax `config.aws.key` and the constants as `config.CONSTANTS.DEFAULT_NULL_VALUE` whereever the config dependency is available to us.

---

## Models

This will be just be a folder with collection of javascript/json files which will describe the schema of tables, indexes. The files reside inside `models/` and these files are only for informative purposes only. If for example there is a table called `users` inside a database called `example` then there will be a folder called `models/example.js` containing:

```js
module.exports = {
	collections: ["users"],
	schema: {
		users: { username: "string", password: "string" },
	},
	indexes: {
		users: [
			[{ username: 1, _id: 1 }, { unique: true }],
			[{ username: 1 }, { unique: true }],
		],
	},
};
```

Alternatively this configuration can be used to intialize any indexes or any tables.

---

## HTTP server middlewares

These middlewares are http server level middlewares, these are defined inside `config/http.js` containing:

```js
let bodyParser = require("body-parser").json({ limit: "50mb" });
let compression = require("compression");
let cors = require("cors");
/* This whitelist can only filter requests from the browser clients */
var whitelist = ["http://localhost:3000", "http://localhost:3000/"];

var corsOptions = {
	origin: function (origin, callback) {
		// console.log("HTTP Origin given = ", origin)
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
```

Here mainly `body-parser`, `cors` and other such http server level middlewares are defined.
