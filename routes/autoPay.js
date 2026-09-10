const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');
const autoPayController = require('../controllers/autoPay');

// Student or admin: view current card on file
router.get('/student/:studentId', isAuth, autoPayController.getCardOnFile);
// Student or admin: register a card on file
router.post('/student/:studentId', isAuth, autoPayController.addCardOnFile);
// Admin: remove a card on file
router.delete('/:id', isAuth, checkPermission(PERMISSIONS.FINANCE_MANAGE), autoPayController.removeCardOnFile);

module.exports = router;
