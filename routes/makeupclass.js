const express = require('express');
const router = express.Router();
const makeupClassController = require('../controllers/makeupclass');

router.post('/schedule', makeupClassController.scheduleClass);

router.get('/getStatus/:studentId', makeupClassController.getStatus);

router.get('/getAllStatus', makeupClassController.getAllStatus);

router.put('/updateStatus/:classId', makeupClassController.updateStatus);

router.delete('/:classId', makeupClassController.deleteClass);





module.exports = router;
