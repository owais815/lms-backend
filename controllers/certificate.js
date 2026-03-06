const { Op } = require('sequelize');
const Certificate = require('../models/Certificate');
const Student = require('../models/Student');
const Courses = require('../models/Course');

// Shared include for full certificate details
const fullInclude = [
    { model: Student, attributes: ['id', 'firstName', 'lastName', 'email'] },
    { model: Courses, attributes: ['id', 'courseName', 'duration'] },
];

// ---------------------------------------------------------------------------
// POST /api/certificates/create
// Admin creates a certificate — either 'upcoming' (pre-schedule) or 'issued'
// Body: courseId, studentId, notes, status ('upcoming' | 'issued')
// File: optional template image
// ---------------------------------------------------------------------------
const createCertificate = async (req, res) => {
    try {
        const { courseId, studentId, notes, status } = req.body;
        const certStatus = status === 'upcoming' ? 'upcoming' : 'issued';

        if (!courseId || !studentId) {
            return res.status(400).json({ message: 'courseId and studentId are required.' });
        }

        const student = await Student.findByPk(studentId);
        if (!student) return res.status(404).json({ message: 'Student not found.' });

        const course = await Courses.findByPk(courseId);
        if (!course) return res.status(404).json({ message: 'Course not found.' });

        // Prevent duplicate active/upcoming certificate for same student+course
        const existing = await Certificate.findOne({
            where: { courseId, studentId, status: { [Op.in]: ['issued', 'upcoming'] } },
        });
        if (existing) {
            return res.status(409).json({
                message: `A certificate (${existing.status}) already exists for this student in this course.`,
            });
        }

        const templateImageUrl = req.file ? `resources/${req.file.filename}` : null;

        const certificate = await Certificate.create({
            courseId,
            studentId,
            templateImageUrl,
            issuedAt: certStatus === 'issued' ? new Date() : null,
            status: certStatus,
            notes: notes || null,
        });

        const full = await Certificate.findByPk(certificate.id, { include: fullInclude });

        const msg = certStatus === 'upcoming' ? 'Upcoming certificate created.' : 'Certificate issued successfully.';
        res.status(201).json({ message: msg, certificate: full });
    } catch (err) {
        console.error('[createCertificate]', err);
        res.status(500).json({ message: 'Failed to create certificate.' });
    }
};

// ---------------------------------------------------------------------------
// PUT /api/certificates/:id/issue
// Admin promotes an upcoming certificate to issued
// ---------------------------------------------------------------------------
const issueCertificateFromUpcoming = async (req, res) => {
    try {
        const { id } = req.params;
        const cert = await Certificate.findByPk(id);
        if (!cert) return res.status(404).json({ message: 'Certificate not found.' });
        if (cert.status !== 'upcoming') {
            return res.status(400).json({ message: 'Only upcoming certificates can be issued.' });
        }

        cert.status = 'issued';
        cert.issuedAt = new Date();
        await cert.save();

        const full = await Certificate.findByPk(id, { include: fullInclude });
        res.json({ message: 'Certificate issued successfully.', certificate: full });
    } catch (err) {
        console.error('[issueCertificateFromUpcoming]', err);
        res.status(500).json({ message: 'Failed to issue certificate.' });
    }
};

// ---------------------------------------------------------------------------
// GET /api/certificates
// Admin: list all certificates (query: ?courseId=&studentId=&status=)
// ---------------------------------------------------------------------------
const getAllCertificates = async (req, res) => {
    try {
        const where = {};
        if (req.query.courseId) where.courseId = req.query.courseId;
        if (req.query.studentId) where.studentId = req.query.studentId;
        if (req.query.status) where.status = req.query.status;

        const certificates = await Certificate.findAll({
            where,
            include: fullInclude,
            order: [['createdAt', 'DESC']],
        });

        res.json({ certificates });
    } catch (err) {
        console.error('[getAllCertificates]', err);
        res.status(500).json({ message: 'Failed to fetch certificates.' });
    }
};

// ---------------------------------------------------------------------------
// GET /api/certificates/student/:studentId
// Student/Parent: view both issued + upcoming certificates for a student
// ---------------------------------------------------------------------------
const getStudentCertificates = async (req, res) => {
    try {
        const { studentId } = req.params;

        const certificates = await Certificate.findAll({
            where: {
                studentId,
                status: { [Op.in]: ['issued', 'upcoming'] },
            },
            include: [{ model: Courses, attributes: ['id', 'courseName', 'duration'] }],
            order: [['createdAt', 'DESC']],
        });

        res.json({ certificates });
    } catch (err) {
        console.error('[getStudentCertificates]', err);
        res.status(500).json({ message: 'Failed to fetch certificates.' });
    }
};

// ---------------------------------------------------------------------------
// PUT /api/certificates/:id/upload-image
// Admin: replace the template image on an existing certificate
// ---------------------------------------------------------------------------
const uploadCertificateImage = async (req, res) => {
    try {
        const { id } = req.params;
        const cert = await Certificate.findByPk(id);
        if (!cert) return res.status(404).json({ message: 'Certificate not found.' });
        if (!req.file) return res.status(400).json({ message: 'No image file provided.' });

        cert.templateImageUrl = `resources/${req.file.filename}`;
        await cert.save();

        res.json({ message: 'Certificate image updated.', templateImageUrl: cert.templateImageUrl });
    } catch (err) {
        console.error('[uploadCertificateImage]', err);
        res.status(500).json({ message: 'Failed to update image.' });
    }
};

// ---------------------------------------------------------------------------
// PUT /api/certificates/:id/revoke
// Admin: revoke an issued certificate
// ---------------------------------------------------------------------------
const revokeCertificate = async (req, res) => {
    try {
        const { id } = req.params;
        const cert = await Certificate.findByPk(id);
        if (!cert) return res.status(404).json({ message: 'Certificate not found.' });
        if (cert.status !== 'issued') {
            return res.status(400).json({ message: 'Only issued certificates can be revoked.' });
        }

        cert.status = 'revoked';
        await cert.save();

        res.json({ message: 'Certificate revoked.' });
    } catch (err) {
        console.error('[revokeCertificate]', err);
        res.status(500).json({ message: 'Failed to revoke certificate.' });
    }
};

// ---------------------------------------------------------------------------
// PUT /api/certificates/:id/restore
// Admin: restore a revoked certificate back to issued
// ---------------------------------------------------------------------------
const restoreCertificate = async (req, res) => {
    try {
        const { id } = req.params;
        const cert = await Certificate.findByPk(id);
        if (!cert) return res.status(404).json({ message: 'Certificate not found.' });
        if (cert.status !== 'revoked') {
            return res.status(400).json({ message: 'Only revoked certificates can be restored.' });
        }

        cert.status = 'issued';
        await cert.save();

        res.json({ message: 'Certificate restored successfully.' });
    } catch (err) {
        console.error('[restoreCertificate]', err);
        res.status(500).json({ message: 'Failed to restore certificate.' });
    }
};

// ---------------------------------------------------------------------------
// DELETE /api/certificates/:id
// Admin: permanently delete any certificate
// ---------------------------------------------------------------------------
const deleteCertificate = async (req, res) => {
    try {
        const { id } = req.params;
        const cert = await Certificate.findByPk(id);
        if (!cert) return res.status(404).json({ message: 'Certificate not found.' });

        await cert.destroy();
        res.json({ message: 'Certificate deleted.' });
    } catch (err) {
        console.error('[deleteCertificate]', err);
        res.status(500).json({ message: 'Failed to delete certificate.' });
    }
};

// ---------------------------------------------------------------------------
// POST /api/certificates/bulk-create
// Admin: create certificates for multiple students at once (no file upload)
// Body (JSON): courseId, studentIds[], status, notes
// ---------------------------------------------------------------------------
const bulkCreateCertificates = async (req, res) => {
    try {
        const { courseId, studentIds, status, notes } = req.body;

        if (!courseId || !Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ message: 'courseId and at least one studentId are required.' });
        }

        const certStatus = status === 'upcoming' ? 'upcoming' : 'issued';

        const course = await Courses.findByPk(courseId);
        if (!course) return res.status(404).json({ message: 'Course not found.' });

        const created = [];
        const skipped = [];

        for (const studentId of studentIds) {
            const student = await Student.findByPk(studentId);
            if (!student) {
                skipped.push({ studentId, reason: 'Student not found.' });
                continue;
            }

            const existing = await Certificate.findOne({
                where: { courseId, studentId, status: { [Op.in]: ['issued', 'upcoming'] } },
            });
            if (existing) {
                skipped.push({ studentId, reason: `Already has a ${existing.status} certificate.` });
                continue;
            }

            const certificate = await Certificate.create({
                courseId,
                studentId,
                templateImageUrl: null,
                issuedAt: certStatus === 'issued' ? new Date() : null,
                status: certStatus,
                notes: notes || null,
            });

            const full = await Certificate.findByPk(certificate.id, { include: fullInclude });
            created.push(full);
        }

        res.status(201).json({
            message: `${created.length} certificate(s) created, ${skipped.length} skipped.`,
            created,
            skipped,
        });
    } catch (err) {
        console.error('[bulkCreateCertificates]', err);
        res.status(500).json({ message: 'Failed to bulk create certificates.' });
    }
};

module.exports = {
    createCertificate,
    bulkCreateCertificates,
    issueCertificateFromUpcoming,
    getAllCertificates,
    getStudentCertificates,
    uploadCertificateImage,
    revokeCertificate,
    restoreCertificate,
    deleteCertificate,
};
