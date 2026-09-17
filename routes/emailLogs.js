'use strict';

const express = require('express');
const controller = require('../controllers/emailLogs');
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// The delivery log contains recipient addresses and rendered message bodies,
// so it sits behind its own permission rather than the general email:view.
router.get('/', isAuth, checkPermission(PERMISSIONS.EMAIL_LOGS), controller.list);
router.get('/metrics', isAuth, checkPermission(PERMISSIONS.EMAIL_LOGS), controller.metrics);
router.get('/:id', isAuth, checkPermission(PERMISSIONS.EMAIL_LOGS), controller.get);
router.post('/:id/resend', isAuth, checkPermission(PERMISSIONS.EMAIL_MANAGE), controller.resend);

module.exports = router;
