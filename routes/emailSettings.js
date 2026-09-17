'use strict';

const express = require('express');
const controller = require('../controllers/emailSettings');
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// Every route is admin-only: checkPermission rejects non-ADMIN userTypes
// outright, before any permission lookup happens.

router.get('/catalog', isAuth, checkPermission(PERMISSIONS.EMAIL_VIEW), controller.getCatalog);
router.get('/global', isAuth, checkPermission(PERMISSIONS.EMAIL_VIEW), controller.getGlobal);
router.get('/status', isAuth, checkPermission(PERMISSIONS.EMAIL_VIEW), controller.getStatus);
router.get('/preview/:eventKey', isAuth, checkPermission(PERMISSIONS.EMAIL_VIEW), controller.preview);

router.put('/events', isAuth, checkPermission(PERMISSIONS.EMAIL_MANAGE), controller.updateEvents);
router.put('/global', isAuth, checkPermission(PERMISSIONS.EMAIL_MANAGE), controller.updateGlobal);

router.post('/test', isAuth, checkPermission(PERMISSIONS.EMAIL_TEST), controller.sendTest);

router.get('/suppressions', isAuth, checkPermission(PERMISSIONS.EMAIL_VIEW), controller.listSuppressions);
router.delete('/suppressions/:id', isAuth, checkPermission(PERMISSIONS.EMAIL_MANAGE), controller.removeSuppression);

module.exports = router;
