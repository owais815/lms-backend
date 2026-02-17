// // socket.js

let io;
let ioInitialized = false;
let ioPromise;

exports.init = (server) => {
  if (ioInitialized) return io;
    io = require('socket.io')(server, {
        cors: {
            origin: '*', // Adjust based on your needs
        },
        path: '/chat/socket.io/', // <-- This makes sure Socket.IO listens on /chat/socket.io/
    });
    ioInitialized = true;

    ioPromise = Promise.resolve(io);
    return io;
};

exports.getIO = () => {
  if (ioPromise) return ioPromise;
};

// socket.js
// let io;
// let ioPromise;

// exports.init = (server) => {
//   if (io) return io; // Return the existing `io` instance if already initialized
//   io = require('socket.io')(server, {
//     cors: {
//       origin: '*', // Adjust based on your needs
//     },
//     path: '/chat/socket.io/', // <-- This makes sure Socket.IO listens on /chat/socket.io/
//   });
//   ioPromise = Promise.resolve(io); // Resolve the promise with the `io` instance
//   return io;
// };

// exports.getIO = () => {
//   if (!ioPromise) {
//     throw new Error('Socket.IO not initialized!');
//   }
//   return ioPromise; // Return the promise that resolves to the `io` instance
// };