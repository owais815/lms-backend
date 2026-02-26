let io;
let ioInitialized = false;
let ioPromise;

exports.init = (server) => {
  if (ioInitialized) return io;
  io = require('socket.io')(server, {
    cors: {
      origin: '*',
    },
    path: '/chat/socket.io/',
  });
  ioInitialized = true;
  ioPromise = Promise.resolve(io);
  return io;
};

exports.getIO = () => {
  if (ioPromise) return ioPromise;
};
