const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is-auth');
const leaveController = require('../controllers/leave');

// Admin/team: list logged leaves
router.get('/', isAuth, leaveController.getLeaves);
// Admin/team: log a leave and notify the affected party
router.post('/', isAuth, leaveController.logLeave);

module.exports = router;
