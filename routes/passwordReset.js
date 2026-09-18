'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/passwordReset');

const router = express.Router();

/**
 * Tighter than the login limiter: each request here sends an email, so an
 * unthrottled endpoint is both an account-enumeration tool and a way to use
 * this server to spam a third party's inbox.
 *
 * Keyed on IP. That is imperfect behind a shared NAT, but the alternative --
 * keying on the submitted address -- lets an attacker lock a specific victim
 * out of the reset flow, which is worse.
 */
const resetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: true, message: 'If that email address has an account, a reset link is on its way.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// All three are public by design -- someone who cannot sign in cannot present a token.
router.post('/forgot-password', resetRequestLimiter, controller.requestReset);
router.get('/reset-password/verify', resetSubmitLimiter, controller.verifyToken);
router.post('/reset-password', resetSubmitLimiter, controller.resetPassword);

module.exports = router;
