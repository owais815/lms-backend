const express = require('express');
const router = express.Router();
const isAuth = require('../middleware/is-auth');
const {
    createCertificate,
    issueCertificateFromUpcoming,
    getAllCertificates,
    getStudentCertificates,
    uploadCertificateImage,
    revokeCertificate,
    restoreCertificate,
    deleteCertificate,
} = require('../controllers/certificate');

// All routes require authentication
router.use(isAuth);

// Admin: create a certificate (upcoming or issued) — global multer handles file
router.post('/create', createCertificate);

// Admin: promote upcoming → issued
router.put('/:id/issue', issueCertificateFromUpcoming);

// Admin: list all certificates (query: ?courseId=&studentId=&status=)
router.get('/', getAllCertificates);

// Student/Parent: get own certificates (issued + upcoming)
router.get('/student/:studentId', getStudentCertificates);

// Admin: replace/upload certificate image
router.put('/:id/upload-image', uploadCertificateImage);

// Admin: revoke an issued certificate
router.put('/:id/revoke', revokeCertificate);

// Admin: restore a revoked certificate back to issued
router.put('/:id/restore', restoreCertificate);

// Admin: delete a certificate
router.delete('/:id', deleteCertificate);

module.exports = router;
