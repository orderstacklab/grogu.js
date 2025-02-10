// Auto-generated service for User
const mongoose = require('mongoose');

module.exports = async function ({ config, Services }) {
    const User = mongoose.model('User');

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

            const items = await User
                .find(filters)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .exec();

            const total = await User.countDocuments(filters);

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
            return User.findById(id);
        },

        create: async function (data) {
            const item = new User(data);
            return item.save();
        },

        update: async function (id, data) {
            return User.findByIdAndUpdate(id, data, { 
                new: true,
                runValidators: true 
            });
        },

        delete: async function (id) {
            return User.findByIdAndDelete(id);
        }
    };
};