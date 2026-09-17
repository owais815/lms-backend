'use strict';

const express = require('express');
const controller = require('../controllers/notificationSettings');
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// Every route is admin-only: checkPermission rejects non-ADMIN userTypes
// outright, before any permission lookup happens.

router.get('/catalog', isAuth, checkPermission(PERMISSIONS.NOTIFICATIONS_VIEW), controller.getCatalog);
router.get('/status', isAuth, checkPermission(PERMISSIONS.NOTIFICATIONS_VIEW), controller.getStatus);

router.put('/events', isAuth, checkPermission(PERMISSIONS.NOTIFICATIONS_MANAGE), controller.updateEvents);
router.put('/categories/:category', isAuth, checkPermission(PERMISSIONS.NOTIFICATIONS_MANAGE), controller.updateCategory);

module.exports = router;
