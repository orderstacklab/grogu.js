// userValidate.js - Validation middleware for User
const validationSchemas = require('../validations/UserSchema');

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
        console.error(`Validation error in ${modelName}:`, err);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};