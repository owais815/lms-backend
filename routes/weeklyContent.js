const express = require('express');
const router = express.Router();
const weeklyContentController = require('../controllers/weeklyContent');
const isAuth = require('../middleware/is-auth');

router.post('/upload',              isAuth, weeklyContentController.uploadResource);
router.get('/:courseDetailId',      isAuth, weeklyContentController.getResources);
router.delete('/:id',               isAuth, weeklyContentController.deleteResource);

module.exports = router;
