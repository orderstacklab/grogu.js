// crudGenerator.js
const fs = require("fs").promises;
const path = require("path");
const mongoose = require("mongoose")

class CRUDGenerator {
	constructor(modelsPath, controllersPath, servicesPath) {
		this.modelsPath = modelsPath;
		this.controllersPath = controllersPath;
		this.servicesPath = servicesPath;
		this.rootDir = path.dirname(require.main.filename);
	}

	// Parse mongoose schema to extract field definitions
	parseMongooseSchema(modelPath) {
		const modelFile = require(modelPath);

		// If it's a mongoose model, get its schema
		if (modelFile.schema) {
			const schema = modelFile.schema;
			const schemaObj = {};

			Object.keys(schema.obj).forEach((field) => {
				const fieldConfig = schema.obj[field];
				schemaObj[field] = {
					type: fieldConfig.type ? fieldConfig.type.name.toLowerCase() : "string",
					required: !!fieldConfig.required,
					unique: !!fieldConfig.unique,
					trim: !!fieldConfig.trim,
					default: fieldConfig.default,
				};
			});

			return {
				name: modelFile.modelName,
				schema: schemaObj,
			};
		}

		// If it's a mongoose schema that hasn't been registered as a model yet
		if (modelFile instanceof mongoose.Schema) {
			const schema = modelFile;
			const modelName = path.basename(modelPath, ".js");

			// Register the model if it hasn't been registered yet
			try {
				if (mongoose.models[modelName]) {
					return {
						name: modelName,
						schema: this.parseSchemaObject(schema.obj),
					};
				}
				mongoose.model(modelName, schema);
				return {
					name: modelName,
					schema: this.parseSchemaObject(schema.obj),
				};
			} catch (error) {
				console.error(`Error registering model ${modelName}:`, error);
				throw error;
			}
		}

		throw new Error(`Invalid model file format: ${modelPath}`);
	}

	// Generate Joi validation schema based on mongoose schema
	generateValidationSchema(modelName, schemaObj) {
		const generateJoiField = (field, config) => {
			let joiField = "Joi";

			switch (config.type) {
				case "string":
					joiField += ".string()";
					if (config.trim) joiField += ".trim()";
					break;
				case "number":
					joiField += ".number()";
					break;
				case "boolean":
					joiField += ".boolean()";
					break;
				case "date":
					joiField += ".date()";
					break;
				case "array":
					joiField += ".array()";
					break;
				case "object":
					joiField += ".object()";
					break;
				default:
					joiField += ".string()";
			}

			if (config.required) joiField += ".required()";
			if (field === "email") joiField += ".email()";
			if (field === "password") joiField += ".min(6)";

			return joiField;
		};

		const schemaFields = Object.entries(schemaObj)
			.map(([field, config]) => {
				if (field === "createdAt" || field === "updatedAt") return null;
				return `    ${field}: ${generateJoiField(field, config)}`;
			})
			.filter(Boolean);

		return `const Joi = require('joi');

// Validation schemas for ${modelName}
module.exports = {
    create: Joi.object({
${schemaFields.join(",\n")}
    }),

    update: Joi.object({
${schemaFields
	.map((field) =>
		field.includes(".required()") ? field.replace(".required()", ".optional()") : field + ".optional()"
	)
	.join(",\n")}
    }),

    query: Joi.object({
        page: Joi.number().min(1),
        limit: Joi.number().min(1).max(100),
        sortBy: Joi.string().valid(${Object.keys(schemaObj)
			.map((field) => `'${field}'`)
			.join(", ")}),
        sortOrder: Joi.string().valid('asc', 'desc'),
        ${Object.keys(schemaObj)
			.filter((field) => !["createdAt", "updatedAt"].includes(field))
			.map((field) => `${field}: Joi.string()`)
			.join(",\n        ")}
    })
};`;
	}

	// Generate validation middleware
	generateValidationMiddleware(modelName) {
		const lowerModelName = modelName.toLowerCase();
		return `// ${lowerModelName}Validate.js - Validation middleware for ${modelName}
const validationSchemas = require('../validations/${modelName}Schema');

module.exports = async function (req, res, next, { Services, config }) {
    try {
        let schema;
        let dataToValidate;

        // Select schema and data based on request method
        if (req.method === 'GET') {
            schema = validationSchemas.query;
            dataToValidate = req.query;
        } else if (req.method === 'POST') {
            schema = validationSchemas.create;
            dataToValidate = req.body;
        } else if (['PUT', 'PATCH'].includes(req.method)) {
            schema = validationSchemas.update;
            dataToValidate = req.body;
        } else {
            return next();
        }

        // Validate the data
        const { error } = schema.validate(dataToValidate, { 
            abortEarly: false,
            stripUnknown: true
        });
        
        if (error) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: error.details.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
        }
        
        next();
    } catch (err) {
        console.error(\`Validation error in \${modelName}:\`, err);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};`;
	}

	generateControllerTemplate(modelName) {
		return `// Auto-generated controller for ${modelName}

module.exports.globalMiddlewares = [];

module.exports.routes = function ({ Services, config }) {
    return {
        "/": {
            method: "get",
            handler: async (req, res) => {
                try {
                    const items = await Services.${modelName}Service.findAll(req.query);
                    res.json({ success: true, data: items });
                } catch (error) {
                    res.status(500).json({ success: false, error: error.message });
                }
            },
            localMiddlewares: ["${modelName.toLowerCase()}Validate"]
        },

        "/:id": {
            method: "get",
            handler: async (req, res) => {
                try {
                    const item = await Services.${modelName}Service.findById(req.params.id);
                    if (!item) {
                        return res.status(404).json({ success: false, error: 'Item not found' });
                    }
                    res.json({ success: true, data: item });
                } catch (error) {
                    res.status(500).json({ success: false, error: error.message });
                }
            }
        },

        "POST /": {
            handler: async (req, res) => {
                try {
                    const item = await Services.${modelName}Service.create(req.body);
                    res.status(201).json({ success: true, data: item });
                } catch (error) {
                    if (error.code === 11000) {
                        return res.status(409).json({ 
                            success: false, 
                            error: 'Duplicate entry found' 
                        });
                    }
                    res.status(500).json({ success: false, error: error.message });
                }
            },
            localMiddlewares: ["${modelName.toLowerCase()}Validate"]
        },

        "PUT /:id": {
            handler: async (req, res) => {
                try {
                    const item = await Services.${modelName}Service.update(req.params.id, req.body);
                    if (!item) {
                        return res.status(404).json({ success: false, error: 'Item not found' });
                    }
                    res.json({ success: true, data: item });
                } catch (error) {
                    if (error.code === 11000) {
                        return res.status(409).json({ 
                            success: false, 
                            error: 'Duplicate entry found' 
                        });
                    }
                    res.status(500).json({ success: false, error: error.message });
                }
            },
            localMiddlewares: ["${modelName.toLowerCase()}Validate"]
        },

        "DELETE /:id": {
            handler: async (req, res) => {
                try {
                    const result = await Services.${modelName}Service.delete(req.params.id);
                    if (!result) {
                        return res.status(404).json({ success: false, error: 'Item not found' });
                    }
                    res.json({ success: true, message: "Item deleted successfully" });
                } catch (error) {
                    res.status(500).json({ success: false, error: error.message });
                }
            }
        }
    };
};`;
	}

	generateServiceTemplate(modelName) {
		return `// Auto-generated service for ${modelName}
const mongoose = require('mongoose');

module.exports = async function ({ config, Services }) {
    const ${modelName} = mongoose.model('${modelName}');

    return {
        findAll: async function (query = {}) {
            const {
                page = 1,
                limit = 10,
                sortBy = 'createdAt',
                sortOrder = 'desc',
                ...filters
            } = query;

            const skip = (page - 1) * limit;
            const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

            const items = await ${modelName}
                .find(filters)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .exec();

            const total = await ${modelName}.countDocuments(filters);

            return {
                items,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        },

        findById: async function (id) {
            return ${modelName}.findById(id);
        },

        create: async function (data) {
            const item = new ${modelName}(data);
            return item.save();
        },

        update: async function (id, data) {
            return ${modelName}.findByIdAndUpdate(id, data, { 
                new: true,
                runValidators: true 
            });
        },

        delete: async function (id) {
            return ${modelName}.findByIdAndDelete(id);
        }
    };
};`;
	}

	async fileExists(filePath) {
		try {
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	async ensureDir(dirPath) {
		try {
			await fs.mkdir(dirPath, { recursive: true });
		} catch (error) {
			if (error.code !== "EEXIST") throw error;
		}
	}

	async generateFilesForModel(modelPath) {
		const { name: modelName, schema } = this.parseMongooseSchema(modelPath);

		const controllerPath = path.join(this.controllersPath, `${modelName}.js`);
		const servicePath = path.join(this.servicesPath, `${modelName}Service.js`);
		const validationsPath = path.join(this.rootDir, "validations");
		const middlewaresPath = path.join(this.rootDir, "middlewares");

		// Ensure directories exist
		await this.ensureDir(validationsPath);
		await this.ensureDir(middlewaresPath);

		// Generate validation schema
		const schemaFilePath = path.join(validationsPath, `${modelName}Schema.js`);
		if (!(await this.fileExists(schemaFilePath))) {
			await fs.writeFile(schemaFilePath, this.generateValidationSchema(modelName, schema));
			console.log(`Generated validation schema for ${modelName}`);
		}

		// Generate validation middleware
		const middlewareFilePath = path.join(middlewaresPath, `${modelName.toLowerCase()}Validate.js`);
		if (!(await this.fileExists(middlewareFilePath))) {
			await fs.writeFile(middlewareFilePath, this.generateValidationMiddleware(modelName));
			console.log(`Generated validation middleware for ${modelName}`);
		}

		// Generate controller
		if (!(await this.fileExists(controllerPath))) {
			await fs.writeFile(controllerPath, this.generateControllerTemplate(modelName));
			console.log(`Generated controller for ${modelName}`);
		}

		// Generate service
		if (!(await this.fileExists(servicePath))) {
			await fs.writeFile(servicePath, this.generateServiceTemplate(modelName));
			console.log(`Generated service for ${modelName}`);
		}
	}

	parseSchemaObject(schemaObj) {
		const parsed = {};
		Object.keys(schemaObj).forEach((field) => {
			const fieldConfig = schemaObj[field];
			parsed[field] = {
				type: fieldConfig.type ? fieldConfig.type.name.toLowerCase() : "string",
				required: !!fieldConfig.required,
				unique: !!fieldConfig.unique,
				trim: !!fieldConfig.trim,
				default: fieldConfig.default,
			};
		});
		return parsed;
	}

	async initialize() {
		try {
			// First, ensure mongoose is connected
			if (mongoose.connection.readyState !== 1) {
				console.log("Waiting for mongoose connection...");
				// You might want to add your mongoose connection logic here
				// or ensure it's connected before calling initialize()
			}

			const modelFiles = await fs.readdir(this.modelsPath);

			// First pass: Register all models
			for (const file of modelFiles) {
				if (file.endsWith(".js") && file !== ".gitkeep") {
					const modelPath = path.join(this.modelsPath, file);
					try {
						require(modelPath);
					} catch (error) {
						console.error(`Error loading model ${file}:`, error);
						throw error;
					}
				}
			}

			// Second pass: Generate CRUD operations
			for (const file of modelFiles) {
				if (file.endsWith(".js") && file !== ".gitkeep") {
					const modelPath = path.join(this.modelsPath, file);
					await this.generateFilesForModel(modelPath);
				}
			}

			console.log("CRUD generation completed successfully");
		} catch (error) {
			console.error("Error generating CRUD operations:", error);
			throw error;
		}
	}
}

module.exports = CRUDGenerator;
