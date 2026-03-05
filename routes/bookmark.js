const express = require('express');
const router = express.Router();
const bookmarkController = require('../controllers/bookmark');
const isAuth = require('../middleware/is-auth');

router.post('/add', isAuth, bookmarkController.toggleBookmark);

// Get bookmarks by studentId
router.get('/student/:studentId', isAuth, bookmarkController.getBookmarks);

router.get('/isBookmarked/:studentId/:resourceId', isAuth, bookmarkController.isBookmarked);
// Unbookmark a resource (sets isBookmarked to false)
router.put('/unbookmark/:studentId/:resourceId', isAuth, bookmarkController.unbookmark);

module.exports = router;
