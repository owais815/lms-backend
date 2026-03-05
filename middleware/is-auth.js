const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.get('Authorization');
  if (!authHeader) {
    const error = new Error('Not authenticated.');
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.split(' ')[1];
  let decodedToken;

  try {
    decodedToken = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    // jwt.verify throws for expired, malformed, or invalid tokens — all are 401
    const error = new Error(err.name === 'TokenExpiredError' ? 'Session expired. Please log in again.' : 'Invalid token.');
    error.statusCode = 401;
    return next(error);
  }

  if (!decodedToken) {
    const error = new Error('Not authenticated.');
    error.statusCode = 401;
    throw error;
  }

  req.userId   = decodedToken.userId;
  req.userType = decodedToken.userType || null;  // 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT'
  req.roleId   = decodedToken.roleId   || null;  // Only set for ADMIN users

  next();
};
