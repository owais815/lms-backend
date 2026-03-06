const express = require('express');
const { body } = require('express-validator');
const parentController = require('../controllers/parent');
const Parent = require('../models/Parent');
const { loginRateLimiter } = require('../middleware/rateLimiter');
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');
const { validatePhone } = require('../utils/phoneCountries');

const router = express.Router();

// ─── Public routes ───────────────────────────────────────────────────────────

router.put('/signup', [
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Please enter a valid email.')
    .custom((value) => {
      return Parent.findOne({ where: { email: value } }).then(existing => {
        if (existing) return Promise.reject('E-mail already exists.');
      });
    }).normalizeEmail(),
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters.')
    .custom((value) => {
      return Parent.findOne({ where: { username: value } }).then(existing => {
        if (existing) return Promise.reject('Username already exists.');
      });
    }),
  body('password').trim().isLength({ min: 5 }).withMessage('Password must be at least 5 characters.'),
  body('firstName').trim().not().isEmpty().withMessage('First name is required.'),
  body('studentIds').optional().isArray().withMessage('studentIds must be an array.'),
  body('contact').optional({ checkFalsy: true }).trim().custom(validatePhone),
], parentController.signup);

router.post('/login', loginRateLimiter, parentController.login);

// ─── Admin-only routes ───────────────────────────────────────────────────────

router.get('/getAll',      isAuth, checkPermission(PERMISSIONS.PARENTS_VIEW),   parentController.getAllParents);
router.delete('/:parentId', isAuth, checkPermission(PERMISSIONS.PARENTS_DELETE), parentController.delete);

// ─── Authenticated routes (parent or admin) ──────────────────────────────────

router.put('/update/:parentId',                   isAuth, parentController.update);
router.post('/getByUsername',                     isAuth, parentController.getStudentByUsername);
router.get('/getById/:parentId',                  isAuth, parentController.getParentById);
router.get('/dashboard/:studentId',               isAuth, parentController.getDashboardData);
router.get('/dashboard/assess/:studentId',        isAuth, parentController.getAssessmentScore);
router.get('/dashboard/leaderboard/:studentId',   isAuth, parentController.getLeaderboard);
router.get('/upcoming-classes/:studentId',        isAuth, parentController.getUpcomingClasses);
router.get('/profileImage/:parentId',             isAuth, parentController.getProfileImage);
router.post('/upload-image',                      isAuth, parentController.uploadImage);

module.exports = router;
