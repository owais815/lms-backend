const express = require('express');
const router = express.Router();
const makeupClassController = require('../controllers/makeupclass');
const isAuth = require('../middleware/is-auth');

router.post('/schedule',                isAuth, makeupClassController.scheduleClass);
router.get('/getStatus/:studentId',     isAuth, makeupClassController.getStatus);
router.get('/getAllStatus',             isAuth, makeupClassController.getAllStatus);
router.put('/updateStatus/:classId',    isAuth, makeupClassController.updateStatus);
router.delete('/:classId',              isAuth, makeupClassController.deleteClass);

module.exports = router;
