'use strict';

const fs = require('fs');
const path = require('path');
const CoursePDF = require('../models/CoursePDF');

// POST /api/course-pdfs/:courseId
// Upload one or more PDFs for a course.
exports.uploadPDFs = async (req, res) => {
  try {
    const { courseId } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No PDF files provided' });
    }

    const records = await Promise.all(
      files.map((file) =>
        CoursePDF.create({
          courseId: Number(courseId),
          originalName: file.originalname,
          filePath: file.path.replace(/\\/g, '/'), // normalise Windows paths
        })
      )
    );

    return res.status(201).json({ message: 'PDFs uploaded', pdfs: records });
  } catch (err) {
    console.error('uploadPDFs error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /api/course-pdfs/:courseId
// Return all PDFs for a course.
exports.getCoursePDFs = async (req, res) => {
  try {
    const { courseId } = req.params;
    const pdfs = await CoursePDF.findAll({
      where: { courseId: Number(courseId) },
      order: [['createdAt', 'ASC']],
    });
    return res.json({ pdfs });
  } catch (err) {
    console.error('getCoursePDFs error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE /api/course-pdfs/:courseId/:pdfId
// Delete a single PDF record and its file from disk.
exports.deletePDF = async (req, res) => {
  try {
    const { courseId, pdfId } = req.params;
    const pdf = await CoursePDF.findOne({
      where: { id: Number(pdfId), courseId: Number(courseId) },
    });
    if (!pdf) return res.status(404).json({ message: 'PDF not found' });

    // Remove file from disk
    const fullPath = path.join(__dirname, '..', pdf.filePath);
    fs.unlink(fullPath, (err) => {
      if (err) console.error('File deletion error (non-fatal):', err.message);
    });

    await pdf.destroy();
    return res.json({ message: 'PDF deleted' });
  } catch (err) {
    console.error('deletePDF error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};
