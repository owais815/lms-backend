const Resource = require('../models/Resource');
const Student = require('../models/Student');
const CourseDetails = require('../models/CourseDetails');
const path = require('path');
const Courses = require('../models/Course');
const WeeklyContent = require('../models/WeeklyContent');
const WeeklyResource = require('../models/WeeklyResources');
const fs = require('fs').promises;
const notify = require('../utils/notify');
const notifyAdmins = require('../utils/notifyAdmins');

exports.uploadResource = async (req, res,next) => {
  console.log("course details id is:::",req.body.courseDetailId)
  try {
    const { courseDetailId, weekNumber, heading } = req.body;
    let weeklyContent = await WeeklyContent.findOne({ where: { courseDetailId, weekNumber } });
       // If week entry doesn't exist, create it
       if (!weeklyContent) {
        console.log("i did n't exist...")
        weeklyContent = await WeeklyContent.create({ courseDetailId, weekNumber, heading });
    }
    const { file } = req;
    if (!file) {
      return res.status(400).json({ message: 'File is required' });
  }
    const originalFilename = file.originalname;
    const filePath = `/resources/${file.filename}`;

    const resource = await WeeklyResource.create({
      fileName: originalFilename,
      fileType: file.mimetype,
      filePath: filePath,
      weeklyContentId: weeklyContent.id,
    });

    // New content, or a re-upload after review — send it back to the review queue.
    if (weeklyContent.status !== 'pending_review') {
      weeklyContent.status = 'pending_review';
      weeklyContent.reviewNote = null;
      await weeklyContent.save();
    }
    notifyAdmins({
      title: 'Lesson Content Submitted',
      message: `New content uploaded for Week ${weeklyContent.weekNumber} — awaiting review.`,
    });

    res.status(201).json({ message: 'Weekly Resources uploaded successfully', resource });
  } catch (error) {
    console.log("error is:::",error);
    // res.status(500).json({ message: 'Error uploading resource', error: error.message });
    next(error);
  }
};

exports.getResources = async (req, res,next) => {
  try {
    const { courseDetailId } = req.params;

       const weeks = await WeeklyContent.findAll({
            where: { courseDetailId },
            include: [{model:WeeklyResource,as:"resources"}]
        });
        
        res.status(200).json({ success: true, data: weeks });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching resources', error: error.message });
    next(error);
  }
};

exports.getResourcesOfStudent = async (req, res,next) => {
  try {
    const { studentId } = req.params;

    const resources = await Resource.findAll({
      where: { studentId },
      include: [
        { model: Student },
        { model: CourseDetails, include: [{ model: Courses }] }
      ]
    });

    res.status(200).json(resources);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching resources', error: error.message });
    next(error);
  }
};
exports.deleteResource = async (req, res,next) => {
  try {
    const { id } = req.params;

    const resource = await WeeklyResource.findByPk(id);
    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    // Delete the file from the server
    const filePath = path.join(__dirname, '..', resource.filePath);
    fs.unlink(filePath);

    await resource.destroy();
    res.status(200).json({ message: 'Resource deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting resource', error: error.message });
    next(error);
  }
};

exports.serveResource = async (req, res,next) => {
  try {
    const { resourceId } = req.params;
    const resource = await Resource.findByPk(resourceId);

    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    const filePath = path.join(__dirname, '..', resource.filePath);
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ message: 'Error serving resource', error: error.message });
    next(error);
  }
};


// GET /api/weeklyContent/pending-review — Admin: content awaiting review
exports.getPendingReview = async (req, res, next) => {
  try {
    const weeks = await WeeklyContent.findAll({
      where: { status: 'pending_review' },
      include: [
        { model: WeeklyResource, as: 'resources' },
        { model: CourseDetails, include: [{ model: Courses }] },
      ],
    });
    res.status(200).json({ success: true, data: weeks });
  } catch (error) {
    next(error);
  }
};

// PUT /api/weeklyContent/:weeklyContentId/review — Admin: approve or send back for edits
exports.reviewContent = async (req, res, next) => {
  try {
    const { weeklyContentId } = req.params;
    const { decision, note } = req.body;
    if (!['approved', 'needs_edit'].includes(decision)) {
      return res.status(422).json({ message: "decision must be 'approved' or 'needs_edit'" });
    }

    const weeklyContent = await WeeklyContent.findByPk(weeklyContentId);
    if (!weeklyContent) return res.status(404).json({ message: 'Weekly content not found' });

    const courseDetail = await CourseDetails.findByPk(weeklyContent.courseDetailId, {
      include: [{ model: Student, attributes: ['id', 'firstName', 'lastName', 'parentId'] }],
    });

    weeklyContent.status = decision;
    weeklyContent.reviewNote = note || null;
    weeklyContent.reviewedById = req.userId || null;
    await weeklyContent.save();

    if (decision === 'approved') {
      if (courseDetail?.teacherId) {
        notify({
          userId: courseDetail.teacherId,
          userType: 'teacher',
          title: 'Lesson Content Approved',
          message: `Your content for Week ${weeklyContent.weekNumber} has been approved.`,
        });
      }
      if (courseDetail?.Student) {
        const shareMsg = `New lesson content is available for Week ${weeklyContent.weekNumber}.`;
        notify({ userId: courseDetail.Student.id, userType: 'student', title: 'New Lesson Content', message: shareMsg });
        if (courseDetail.Student.parentId) {
          notify({ userId: courseDetail.Student.parentId, userType: 'parent', title: 'New Lesson Content', message: shareMsg });
        }
      }
    } else if (courseDetail?.teacherId) {
      notify({
        userId: courseDetail.teacherId,
        userType: 'teacher',
        title: 'Lesson Content Needs Edits',
        message: `Your content for Week ${weeklyContent.weekNumber} needs edits${note ? `: ${note}` : '.'}`,
        priority: 'warning',
      });
    }

    res.status(200).json({ success: true, data: weeklyContent });
  } catch (error) {
    next(error);
  }
};

exports.uploadProgress = async (req, res, next) => {
  try {
    // Check if a file has been uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Construct the file URL
    const fileUrl = `${req.protocol}://${req.get('host')}/resources/${req.file.filename}`;

    // You can log or handle the file URL in a database if needed

    // Send a successful response with the uploaded file's URL
    res.status(201).json({
      message: 'Resource uploaded successfully',
      url: fileUrl,  // Return the file URL for use in frontend/social sharing
    });
    // After response, delete the file from the server
    const filePath = path.join(__dirname, '../resources', req.file.filename);
    
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Error deleting file:', err);
      } else {
        console.log('File deleted successfully');
      }
    });
  } catch (error) {
    // Handle any errors and pass them to the global error handler
    next(error);
  }
};
