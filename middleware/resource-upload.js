const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('Storing in:', file);
    cb(null, 'resources');
  },
  filename: (req, file, cb) => {
    console.log('Storing file:', file.originalname);
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  // Add any file type restrictions here if needed
  console.log('Filtering file:', file.mimetype);
  cb(null, true);
};

module.exports = multer({ storage: storage, fileFilter: fileFilter });