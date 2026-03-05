'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();
const ctrl = require('../controllers/coursePDF');
const isAuth = require('../middleware/is-auth');

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

// Up to 10 PDFs per upload, 20MB per file
const uploadPdfs = multer({
  storage: pdfStorage,
  fileFilter: pdfFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
}).array('pdfs', 10);

router.post('/:courseId',          isAuth, uploadPdfs, ctrl.uploadPDFs);
router.get('/:courseId',           isAuth, ctrl.getCoursePDFs);
router.delete('/:courseId/:pdfId', isAuth, ctrl.deletePDF);

module.exports = router;
