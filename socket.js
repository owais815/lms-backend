const jwt = require('jsonwebtoken');

let io;
let ioInitialized = false;
let ioPromise;

exports.init = (server) => {
  if (ioInitialized) return io;

  const allowedOrigins = [
    process.env.CORS_ORIGIN_DEV,
    process.env.CORS_ORIGIN_PROD,
  ].filter(Boolean);

  io = require('socket.io')(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    path: '/chat/socket.io/',
  });

  // JWT authentication middleware for every socket connection.
  // The client must send: socket = io(url, { auth: { token: '<bearer>' } })
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
      || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication required: no token provided.'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Attach decoded identity to socket for use in handlers
      socket.userId   = decoded.userId;
      socket.userType = decoded.userType || null;
      socket.roleId   = decoded.roleId   || null;
      next();
    } catch (err) {
      next(new Error('Authentication failed: invalid or expired token.'));
    }
  });

  ioInitialized = true;
  ioPromise = Promise.resolve(io);
  return io;
};

exports.getIO = () => {
  if (ioPromise) return ioPromise;
};
