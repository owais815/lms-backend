const express = require('express');
const router = express.Router();
const bookmarkController = require('../controllers/bookmark');

router.post('/add', bookmarkController.toggleBookmark);

// Get bookmarks by studentId
router.get('/student/:studentId', bookmarkController.getBookmarks);

router.get('/isBookmarked/:studentId/:resourceId', bookmarkController.isBookmarked);
// Unbookmark a resource (sets isBookmarked to false)
router.put('/unbookmark/:studentId/:resourceId', bookmarkController.unbookmark);

module.exports = router;
