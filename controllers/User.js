// Auto-generated controller for User

module.exports.globalMiddlewares = [];

module.exports.routes = function ({ Services, config }) {
    return {
        "/": {
            method: "get",
            handler: async (req, res) => {
                try {
                    const items = await Services.UserService.findAll(req.query);
                    res.json({ success: true, data: items });
                } catch (error) {
                    res.status(500).json({ success: false, error: error.message });
                }
            },
            localMiddlewares: ["userValidate"]
        },

        "/:id": {
            method: "get",
            handler: async (req, res) => {
                try {
                    const item = await Services.UserService.findById(req.params.id);
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
                    const item = await Services.UserService.create(req.body);
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
            localMiddlewares: ["userValidate"]
        },

        "PUT /:id": {
            handler: async (req, res) => {
                try {
                    const item = await Services.UserService.update(req.params.id, req.body);
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
            localMiddlewares: ["userValidate"]
        },

        "DELETE /:id": {
            handler: async (req, res) => {
                try {
                    const result = await Services.UserService.delete(req.params.id);
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
};