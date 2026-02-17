const MyBookmark = require('../models/Bookmarks/MyBookmark');
const Student = require('../models/Student');
const CourseDetails = require('../models/CourseDetails');
const Courses = require('../models/Course');

// Add a new bookmark
exports.toggleBookmark = async (req, res) => {
    try {
      const { url, studentId, resourceId, courseId } = req.body;
  
      // Ensure student and course exist
      const student = await Student.findByPk(studentId);
      const course = await CourseDetails.findByPk(courseId,{
        include: [
          { model: Courses }
        ]
      });
  
      if (!student || !course) {
        return res.status(404).json({ message: 'Student or Course not found' });
      }
  
      // Check if the bookmark already exists
      let bookmark = await MyBookmark.findOne({
        where: { studentId, resourceId },
      });
  
      if (bookmark) {
        // If it exists, toggle the bookmark status
        bookmark.isBookmarked = !bookmark.isBookmarked;
        await bookmark.save();
  
        const message = bookmark.isBookmarked
          ? 'Resource bookmarked'
          : 'Resource unbookmarked';
        return res.status(200).json({ message, bookmark });
      }
  
      // If the bookmark doesn't exist, create a new one as bookmarked
      bookmark = await MyBookmark.create({
        url,
        studentId,
        resourceId,
        courseId,
        isBookmarked: true, // Create as bookmarked initially
      });
  
      return res.status(201).json({ message: 'Resource bookmarked', bookmark });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to toggle bookmark' });
    }
  };
  

// Get bookmarks for a student
exports.getBookmarks = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const bookmarks = await MyBookmark.findAll({ where: { studentId, isBookmarked: true },include: [{ model: CourseDetails, include: [{ model: Courses }] }] });
    return res.status(200).json(bookmarks);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
};

// Unbookmark a resource
exports.unbookmark = async (req, res) => {
    try {
      const { studentId, resourceId } = req.params;
  
      const bookmark = await MyBookmark.findOne({
        where: { studentId, resourceId },
      });
  
      if (!bookmark) {
        return res.status(404).json({ message: 'Bookmark not found' });
      }
  
      // Update isBookmarked to false instead of deleting the bookmark
      bookmark.isBookmarked = false;
      await bookmark.save();
      
      return res.status(200).json({ message: 'Bookmark removed successfully' });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to remove bookmark' });
    }
  };
  
// Check if a resource is bookmarked by a student
exports.isBookmarked = async (req, res) => {
    try {
      const { studentId, resourceId } = req.params;
  
      const bookmark = await MyBookmark.findOne({
        where: { studentId, resourceId },
        attributes: ['isBookmarked'], 
      });
      if (bookmark) {
        return res.status(200).json({ isBookmarked: bookmark.isBookmarked });
      } else {
        return res.status(200).json({ isBookmarked: false });
      }
    } catch (error) {
      return res.status(500).json({ error: 'Failed to check bookmark status' });
    }
  };
  