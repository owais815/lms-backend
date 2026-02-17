// const http = require('http');

// exports.startServer = (app) => {
//     const server = http.createServer(app).listen(8080, () => {
//         console.log('HTTP server running on port 8080');
//     });
    
//     const io = require('../socket').init(server);
//     io.on('connection', socket => {
//         console.log('client connected');
//     });
// };
// config/development.js
const http = require('http');

exports.startServer = (app) => {
    try {
        const server = http.createServer(app).listen(8080, () => {
            console.log('HTTP server running on port 8080');
        });
        
        const io = require('../socket').init(server);
        
        // Socket connection handling
        io.on('connection', socket => {
            console.log('Client connected with ID:', socket.id);

            // Handle user connection
            socket.on('userConnected', async (data) => {
                // console.log('User connected event:', data);
                const { userId, userType } = data;
                
                // Store user connection info
                socket.userId = userId;
                socket.userType = userType;
                
                // You can emit back to confirm connection
                socket.emit('connectionConfirmed', {
                    message: 'Successfully connected',
                    userId,
                    userType
                });
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });

            // Handle errors
            socket.on('error', (error) => {
                console.error('Socket error:', error);
            });
        });

        return server;
    } catch (error) {
        console.error('Error starting server:', error);
        throw error;
    }
};

// Export other config values
exports.port = 8080;