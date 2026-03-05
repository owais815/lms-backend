const express = require('express');
const {body} = require('express-validator');
const authController = require('../controllers/auth');
const { loginRateLimiter } = require('../middleware/rateLimiter');
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.put('/signup',[
    body('username').trim().isLength({min:5}),
    body('password').trim().isLength({min:5}),
    body('name').trim().not().isEmpty()
],authController.signup);

router.post('/login', loginRateLimiter, authController.login);

// Role/rights management — requires admin auth + roles:manage permission
router.post('/addRole',        isAuth, checkPermission(PERMISSIONS.ROLES_MANAGE), authController.addRole);
router.post('/addRights',      isAuth, checkPermission(PERMISSIONS.ROLES_MANAGE), authController.addRights);
router.post('/addAdminRights', isAuth, checkPermission(PERMISSIONS.ROLES_MANAGE), authController.addAdminRights);

module.exports = router;
