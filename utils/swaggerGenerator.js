// utils/swaggerGenerator.js
const fs = require("fs").promises;
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const mongoose = require("mongoose");

class SwaggerGenerator {
	constructor(app) {
		this.app = app;
		this.swaggerDoc = {
			openapi: "3.0.0",
			info: {
				title: "API Documentation",
				version: "1.0.0",
				description: "API Documentation",
			},
			servers: [
				{
					url: process.env.API_URL || "http://localhost:3000",
					description: "API Server",
				},
			],
			components: {
				schemas: {},
				securitySchemes: {
					bearerAuth: {
						type: "http",
						scheme: "bearer",
						bearerFormat: "JWT",
					},
				},
				examples: {},
				responses: {},
			},
			paths: {},
			tags: [],
		};
	}

	addErrorExamples() {
		this.swaggerDoc.components.responses = {
			ValidationError: {
				description: "Validation error",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								success: { type: "boolean" },
								error: { type: "string" },
								details: {
									type: "array",
									items: {
										type: "object",
										properties: {
											field: { type: "string" },
											message: { type: "string" },
										},
									},
								},
							},
						},
						examples: {
							validationError: {
								value: {
									success: false,
									error: "Validation failed",
									details: [
										{
											field: "email",
											message: "Email is required",
										},
										{
											field: "password",
											message: "Password must be at least 6 characters",
										},
									],
								},
							},
						},
					},
				},
			},
			NotFound: {
				description: "Resource not found",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								success: { type: "boolean" },
								error: { type: "string" },
							},
						},
						examples: {
							notFound: {
								value: {
									success: false,
									error: "Item not found",
								},
							},
						},
					},
				},
			},
			ServerError: {
				description: "Internal server error",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								success: { type: "boolean" },
								error: { type: "string" },
							},
						},
						examples: {
							serverError: {
								value: {
									success: false,
									error: "Internal server error",
								},
							},
						},
					},
				},
			},
		};
	}

	// Add method to generate examples for a model
	generateModelExamples(modelName, schema) {
		const example = {};
		const properties = schema.paths || schema.obj;

		Object.keys(properties).forEach((field) => {
			if (field === "__v" || field === "_id") return;

			const fieldConfig = properties[field];
			example[field] = this.generateExampleValue(field, fieldConfig);
		});

		// Add to components.examples
		this.swaggerDoc.components.examples[modelName] = {
			value: example,
		};

		return example;
	}

	generateExampleValue(field, config) {
		switch (field) {
			case "email":
				return "user@example.com";
			case "name":
				return "John Doe";
			case "password":
				return "password123";
			case "createdAt":
			case "updatedAt":
				return new Date().toISOString();
			default:
				switch (config.instance || config.type?.name) {
					case "String":
						return `Sample ${field}`;
					case "Number":
						return 42;
					case "Boolean":
						return true;
					case "Date":
						return new Date().toISOString();
					case "Array":
						return [];
					case "ObjectId":
						return "507f1f77bcf86cd799439011";
					default:
						return null;
				}
		}
	}

	// Method to manually add an API endpoint
	addCustomEndpoint({
		path,
		method,
		tags,
		summary,
		description,
		parameters = [],
		requestBody = null,
		responses = {},
		security = [],
		examples = {},
	}) {
		// Ensure path starts with /
		path = path.startsWith("/") ? path : `/${path}`;

		// Add the endpoint
		this.swaggerDoc.paths[path] = {
			...(this.swaggerDoc.paths[path] || {}),
			[method.toLowerCase()]: {
				tags,
				summary,
				description,
				parameters,
				...(requestBody && { requestBody }),
				responses,
				...(security.length > 0 && { security }),
			},
		};

		// Add examples if provided
		if (Object.keys(examples).length > 0) {
			Object.keys(examples).forEach((exampleKey) => {
				this.swaggerDoc.components.examples[exampleKey] = {
					value: examples[exampleKey],
				};
			});
		}
	}

	// Parse mongoose model and generate OpenAPI schema
	parseMongooseSchema(schema) {
		const properties = {};
		const required = [];

		// Get paths from mongoose schema
		const paths = schema.paths;

		Object.keys(paths).forEach((field) => {
			// Skip __v and _id fields
			if (field === "__v" || field === "_id") return;

			const fieldConfig = paths[field];
			const type = fieldConfig.instance; // This gives us the type name directly

			properties[field] = {
				type: this.mapType(type),
				description: `The ${field} field`,
			};

			if (fieldConfig.options && fieldConfig.options.required) {
				required.push(field);
			}

			// Add format for specific fields
			if (field === "email") {
				properties[field].format = "email";
			}
			if (field === "password") {
				properties[field].format = "password";
				properties[field].minLength = 6;
			}
		});

		return {
			type: "object",
			properties,
			required: required.length > 0 ? required : undefined,
		};
	}

	// Map mongoose types to OpenAPI types
	mapType(mongooseType) {
		const typeMap = {
			String: "string",
			Number: "number",
			Boolean: "boolean",
			Date: "string",
			ObjectId: "string",
			Array: "array",
			Object: "object",
		};
		return typeMap[mongooseType] || "string";
	}

	// Generate paths for a model
	generateModelPaths(modelName, modelSchema, version = "v1.0") {
		// Generate example data
		const example = this.generateModelExamples(modelName, modelSchema);

		const basePath = `/${modelName}/${version}`;
		const tag = modelName;

		// Add model schema to components
		this.swaggerDoc.components.schemas[modelName] = this.parseMongooseSchema(modelSchema);

		// Add tag
		if (!this.swaggerDoc.tags.find((t) => t.name === tag)) {
			this.swaggerDoc.tags.push({
				name: tag,
				description: `Operations for ${modelName}`,
			});
		}

		// Define paths
		this.swaggerDoc.paths[`${basePath}/`] = {
			get: {
				tags: [tag],
				summary: `Get all ${modelName}`,
				parameters: [
					{
						in: "query",
						name: "page",
						schema: { type: "integer", minimum: 1, default: 1 },
					},
					{
						in: "query",
						name: "limit",
						schema: { type: "integer", minimum: 1, maximum: 100, default: 10 },
					},
					{
						in: "query",
						name: "sortBy",
						schema: { type: "string", default: "createdAt" },
					},
					{
						in: "query",
						name: "sortOrder",
						schema: { type: "string", enum: ["asc", "desc"], default: "desc" },
					},
				],
				responses: this.generateListResponse(modelName),
			},
			post: {
				tags: [tag],
				summary: `Create a new ${modelName}`,
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								$ref: `#/components/schemas/${modelName}`,
							},
						},
					},
				},
				responses: this.generateCreateResponse(modelName),
			},
		};

		// Single item operations
		this.swaggerDoc.paths[`${basePath}/{id}`] = {
			get: {
				tags: [tag],
				summary: `Get a ${modelName} by ID`,
				parameters: [this.generateIdParameter()],
				responses: this.generateGetResponse(modelName),
			},
			put: {
				tags: [tag],
				summary: `Update a ${modelName}`,
				parameters: [this.generateIdParameter()],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								$ref: `#/components/schemas/${modelName}`,
							},
						},
					},
				},
				responses: this.generateUpdateResponse(modelName),
			},
			delete: {
				tags: [tag],
				summary: `Delete a ${modelName}`,
				parameters: [this.generateIdParameter()],
				responses: this.generateDeleteResponse(),
			},
		};
	}

	generateListResponse(modelName) {
		return {
			200: {
				description: "Successful operation",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								success: { type: "boolean" },
								data: {
									type: "object",
									properties: {
										items: {
											type: "array",
											items: {
												$ref: `#/components/schemas/${modelName}`,
											},
										},
										pagination: {
											type: "object",
											properties: {
												page: { type: "integer" },
												limit: { type: "integer" },
												total: { type: "integer" },
												pages: { type: "integer" },
											},
										},
									},
								},
							},
						},
						examples: {
							success: {
								value: {
									success: true,
									data: {
										items: [
											{
												_id: "507f1f77bcf86cd799439011",
												...this.swaggerDoc.components.examples[modelName].value,
											},
											{
												_id: "507f1f77bcf86cd799439012",
												...this.swaggerDoc.components.examples[modelName].value,
											},
										],
										pagination: {
											page: 1,
											limit: 10,
											total: 2,
											pages: 1,
										},
									},
								},
							},
						},
					},
				},
			},
			400: { $ref: "#/components/responses/ValidationError" },
			500: { $ref: "#/components/responses/ServerError" },
		};
	}

	generateCreateResponse(modelName) {
		return {
			201: {
				description: "Created successfully",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								success: { type: "boolean" },
								data: {
									$ref: `#/components/schemas/${modelName}`,
								},
							},
						},
						examples: {
							success: {
								value: {
									success: true,
									data: {
										_id: "507f1f77bcf86cd799439011",
										...this.swaggerDoc.components.examples[modelName].value,
									},
								},
							},
						},
					},
				},
			},
			400: { $ref: "#/components/responses/ValidationError" },
			500: { $ref: "#/components/responses/ServerError" },
		};
	}

	generateGetResponse(modelName) {
		return {
			200: {
				description: "Successful operation",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								success: { type: "boolean" },
								data: {
									$ref: `#/components/schemas/${modelName}`,
								},
							},
						},
						examples: {
							success: {
								value: {
									success: true,
									data: {
										_id: "507f1f77bcf86cd799439011",
										...this.swaggerDoc.components.examples[modelName].value,
									},
								},
							},
						},
					},
				},
			},
			404: { $ref: "#/components/responses/NotFound" },
			500: { $ref: "#/components/responses/ServerError" },
		};
	}

	generateUpdateResponse(modelName) {
		return {
			200: {
				description: "Updated successfully",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								success: { type: "boolean" },
								data: {
									$ref: `#/components/schemas/${modelName}`,
								},
							},
						},
						examples: {
							success: {
								value: {
									success: true,
									data: {
										_id: "507f1f77bcf86cd799439011",
										...this.swaggerDoc.components.examples[modelName].value,
									},
								},
							},
						},
					},
				},
			},
			400: { $ref: "#/components/responses/ValidationError" },
			404: { $ref: "#/components/responses/NotFound" },
			500: { $ref: "#/components/responses/ServerError" },
		};
	}

	generateDeleteResponse() {
		return {
			200: {
				description: "Deleted successfully",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								success: { type: "boolean" },
								message: { type: "string" },
							},
						},
						examples: {
							success: {
								value: {
									success: true,
									message: "Item deleted successfully",
								},
							},
						},
					},
				},
			},
			404: { $ref: "#/components/responses/NotFound" },
			500: { $ref: "#/components/responses/ServerError" },
		};
	}

	generateValidationErrorResponse() {
		return {
			description: "Validation error",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							success: { type: "boolean" },
							error: { type: "string" },
							details: {
								type: "array",
								items: {
									type: "object",
									properties: {
										field: { type: "string" },
										message: { type: "string" },
									},
								},
							},
						},
					},
				},
			},
		};
	}

	generateNotFoundResponse() {
		return {
			description: "Not found",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							success: { type: "boolean" },
							error: { type: "string" },
						},
					},
				},
			},
		};
	}

	generateIdParameter() {
		return {
			name: "id",
			in: "path",
			required: true,
			schema: {
				type: "string",
				format: "mongodb-id",
			},
			description: "The ID of the resource",
		};
	}

	// Add method to load existing swagger document
	async loadExistingSwagger(swaggerPath) {
		try {
			const existingDoc = await fs.readFile(swaggerPath, "utf8");
			const parsedDoc = JSON.parse(existingDoc);

			// Merge existing doc with default doc
			this.swaggerDoc = {
				...this.swaggerDoc,
				...parsedDoc,
				components: {
					...this.swaggerDoc.components,
					...parsedDoc.components,
					schemas: {
						...this.swaggerDoc.components.schemas,
						...parsedDoc.components?.schemas,
					},
					examples: {
						...this.swaggerDoc.components.examples,
						...parsedDoc.components?.examples,
					},
					responses: {
						...this.swaggerDoc.components.responses,
						...parsedDoc.components?.responses,
					},
				},
				paths: {
					...this.swaggerDoc.paths,
					...parsedDoc.paths,
				},
				tags: [...this.swaggerDoc.tags, ...(parsedDoc.tags || [])],
			};

			// Remove duplicate tags
			this.swaggerDoc.tags = Array.from(new Map(this.swaggerDoc.tags.map((tag) => [tag.name, tag])).values());

			console.log("Successfully loaded existing Swagger documentation");
		} catch (error) {
			if (error.code === "ENOENT") {
				console.log("No existing swagger.json found, starting with default configuration");
			} else {
				console.error("Error loading existing swagger documentation:", error);
			}
		}
	}

	// Add method to refresh Swagger UI
	refreshSwagger() {
		try {
			// Check if app and router exist
			if (this.app && this.app._router) {
				// Remove existing swagger route
				this.app._router.stack = this.app._router.stack.filter((layer) => {
					return !layer.route || layer.route.path !== "/api-docs";
				});
			}

			// Remove existing middleware
			const swaggerIndex = this.app._router?.stack?.findIndex((middleware) => middleware.name === "swaggerUi");

			if (swaggerIndex !== undefined && swaggerIndex !== -1) {
				this.app._router.stack.splice(swaggerIndex, 1);
			}

			// Setup Swagger UI again with updated docs
			this.app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(this.swaggerDoc));

			console.log("Swagger documentation refreshed successfully");
		} catch (error) {
			console.error("Error refreshing Swagger UI:", error);
			// Still try to setup Swagger even if removal failed
			this.app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(this.swaggerDoc));
		}
	}

	// Method to update all documentation
	async updateDocs(modelsPath) {
		// Reset paths and schemas as they'll be regenerated
		this.swaggerDoc.paths = {};
		this.swaggerDoc.components.schemas = {};
		this.swaggerDoc.tags = [];

		// Add error examples back
		this.addErrorExamples();

		// Re-process all models
		const modelFiles = await fs.readdir(modelsPath);
		for (const file of modelFiles) {
			if (file.endsWith(".js") && file !== ".gitkeep") {
				try {
					// Get model name and use existing mongoose model
					const modelName = file.replace(".js", "");
					// Convert to proper model name (e.g., "Users.js" -> "User")
					const properModelName = modelName.endsWith("s") ? modelName.slice(0, -1) : modelName;

					const model = mongoose.models[properModelName];

					if (model && model.schema) {
						this.generateModelPaths(modelName, model.schema);
					} else {
						console.log(`Skipping ${file} - no valid Mongoose schema found`);
					}
				} catch (error) {
					console.error(`Error processing model file ${file}:`, error);
				}
			}
		}

		// Refresh the Swagger UI
		this.refreshSwagger();
	}

	// Initialize Swagger documentation for all models
	async initialize(modelsPath) {
		await this.updateDocs(modelsPath);

		// Add endpoint to manually refresh swagger
		this.app.post("/api/refresh-docs", async (req, res) => {
			try {
				await this.updateDocs(modelsPath);
				res.json({ success: true, message: "API documentation refreshed" });
			} catch (error) {
				console.error("Error refreshing API docs:", error);
				res.status(500).json({ success: false, error: "Failed to refresh API documentation" });
			}
		});
	}

	// Generate static HTML documentation
	async generateStaticDocs() {
		const docsPath = path.join(this.app.get("rootDir") || process.cwd(), "docs");
		await fs.mkdir(docsPath, { recursive: true });

		// Generate swagger.json
		await fs.writeFile(path.join(docsPath, "swagger.json"), JSON.stringify(this.swaggerDoc, null, 2));

		// Generate index.html
		const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css" />
    <style>
        body {
            margin: 0;
            padding: 0;
        }
        #swagger-ui {
            max-width: 1460px;
            margin: 0 auto;
            padding: 20px;
            background: white;
        }
        .topbar {
            display: none;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: "./swagger.json",
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                persistAuthorization: true,
                defaultModelsExpandDepth: 3,
                defaultModelExpandDepth: 3,
                defaultModelRendering: 'model',
                displayRequestDuration: true,
                docExpansion: 'list',
                filter: true,
                showExtensions: true
            });
            window.ui = ui;
        }
    </script>
</body>
</html>`;

		await fs.writeFile(path.join(docsPath, "index.html"), html);

		// Generate README with hosting instructions
		const readme = `# API Documentation

## Hosting Instructions

You can host this documentation in multiple ways:

1. **Using Python's Simple HTTP Server**
   \`\`\`bash
   cd docs
   python -m http.server 8000
   \`\`\`
   Then visit: http://localhost:8000

2. **Using Node's http-server**
   First install: npm install -g http-server
   \`\`\`bash
   cd docs
   http-server
   \`\`\`
   Then visit: http://localhost:8080

3. **Using any static file hosting service**
   - Upload the contents of this directory to your hosting service
   - Access the index.html file

4. **Using GitHub Pages**
   - Push this docs folder to a GitHub repository
   - Enable GitHub Pages in repository settings
   - Access via: https://[username].github.io/[repo-name]

The documentation will be automatically updated whenever your API changes.`;

		await fs.writeFile(path.join(docsPath, "README.md"), readme);

		console.log("Static documentation generated in /docs directory");
		return docsPath;
	}
}

module.exports = SwaggerGenerator;
