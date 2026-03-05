// config/development.js
const http = require('http');

exports.startServer = (app) => {
    try {
        const server = http.createServer(app).listen(8080, () => {
            console.log('[dev] HTTP server running on port 8080');
        });

        // Initialize Socket.IO on the server.
        // The connection handler is registered in app.js AFTER this returns,
        // so we do NOT attach any io.on('connection') here to avoid duplicates.
        require('../socket').init(server);

        return server;
    } catch (error) {
        console.error('[dev] Error starting server:', error);
        throw error;
    }
};

exports.port = 8080;
