const rateLimit = require('express-rate-limit');

// Lazy-load to avoid circular deps at startup
let notifyAdmins;
const getNotifyAdmins = () => {
  if (!notifyAdmins) notifyAdmins = require('../utils/notifyAdmins');
  return notifyAdmins;
};

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const path = req.path || req.url || '';
    getNotifyAdmins()({
      title: 'Brute-Force Alert',
      message: `Excessive login attempts detected from IP ${ip} on ${path}. Account may be under attack.`,
      priority: 'critical',
    }).catch(() => {});
    res.status(options.statusCode).json(options.message);
  },
});

module.exports = { loginRateLimiter };
