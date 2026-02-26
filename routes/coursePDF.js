'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const ctrl = require('../controllers/coursePDF');

// PDF-specific storage — same resources/ folder, same naming pattern
const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'resources'),
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    cb(null, `${timestamp}-${file.originalname}`);
  },
});

const pdfFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

// Up to 10 PDFs per upload, field name "pdfs"
const uploadPdfs = multer({ storage: pdfStorage, fileFilter: pdfFilter }).array('pdfs', 10);

router.post('/:courseId', uploadPdfs, ctrl.uploadPDFs);
router.get('/:courseId', ctrl.getCoursePDFs);
router.delete('/:courseId/:pdfId', ctrl.deletePDF);

module.exports = router;
