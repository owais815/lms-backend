const Resource = require('../models/Resource');
const Student = require('../models/Student');
const CourseDetails = require('../models/CourseDetails');
const path = require('path');
const Courses = require('../models/Course');
const fs = require('fs').promises;

exports.uploadResource = async (req, res,next) => {

  try {
    const { studentId, courseId,teacherId } = req.body;
    const { file } = req;
    const originalFilename = file.originalname;
    const filePath = `/resources/${file.filename}`;

    const resource = await Resource.create({
      fileName: originalFilename,
      fileType: file.mimetype,
      filePath: filePath,
      uploadedBy: teacherId,
      studentId: studentId,
      courseId: courseId
    });

    res.status(201).json({ message: 'Resource uploaded successfully', resource });
  } catch (error) {
    // res.status(500).json({ message: 'Error uploading resource', error: error.message });
    next(error);
  }
};

exports.getResources = async (req, res,next) => {
  try {
    const { studentId, courseId } = req.params;

    const resources = await Resource.findAll({
      where: { studentId, courseId },
      include: [
        { model: Student, attributes: ["id", "firstName", "lastName","profileImg"]},
        { model: CourseDetails, include: [{ model: Courses,attributes: ['courseName'] }] }
      ]
    });

    res.status(200).json(resources);
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
    const { resourceId } = req.params;

    const resource = await Resource.findByPk(resourceId);
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
