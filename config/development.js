// config/development.js
const http = require('http');

// Kept so app.js's SIGTERM handler can close the listener on shutdown.
let activeServer = null;

exports.startServer = (app) => {
    try {
        const port = process.env.HTTP_PORT || 8080;
        const server = http.createServer(app).listen(port, () => {
            console.log(`[dev] HTTP server running on port ${port}`);
        });

        // Initialize Socket.IO on the server.
        // The connection handler is registered in app.js AFTER this returns,
        // so we do NOT attach any io.on('connection') here to avoid duplicates.
        require('../socket').init(server);

        activeServer = server;
        return server;
    } catch (error) {
        console.error('[dev] Error starting server:', error);
        throw error;
    }
};

exports.getServer = () => activeServer;

exports.port = 8080;
