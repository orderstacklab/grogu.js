const Joi = require("joi");

// Validation schemas for User
module.exports = {
	create: Joi.object({
		name: Joi.string().trim().required(),
		email: Joi.string().trim().required().email(),
		password: Joi.string().required().min(6),
	}),

	update: Joi.object({
		name: Joi.string().trim().optional(),
		email: Joi.string().trim().optional().email(),
		password: Joi.string().optional().min(6),
	}),

	query: Joi.object({
		page: Joi.number().min(1),
		limit: Joi.number().min(1).max(100),
		sortBy: Joi.string().valid("name", "email", "password", "createdAt"),
		sortOrder: Joi.string().valid("asc", "desc"),
		name: Joi.string(),
		email: Joi.string(),
		password: Joi.string(),
	}),
};
