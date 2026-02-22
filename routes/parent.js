const express = require('express');
const {body} = require('express-validator');
const parentController = require('../controllers/parent');
const Parent = require('../models/Parent');
const { loginRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.put('/signup', [
    body('email').optional({ checkFalsy: true }).isEmail().withMessage("Please enter a valid email.")
        .custom((value) => {
            return Parent.findOne({ where: { email: value } }).then(existing => {
                if (existing) return Promise.reject("E-mail already exists.");
            });
        }).normalizeEmail(),
    body('username').trim().isLength({ min: 3 }).withMessage("Username must be at least 3 characters.")
        .custom((value) => {
            return Parent.findOne({ where: { username: value } }).then(existing => {
                if (existing) return Promise.reject("Username already exists.");
            });
        }),
    body('password').trim().isLength({ min: 5 }).withMessage("Password must be at least 5 characters."),
    body('firstName').trim().not().isEmpty().withMessage("First name is required."),
    body('studentIds').optional().isArray().withMessage("studentIds must be an array."),
], parentController.signup);


router.post('/login', loginRateLimiter, parentController.login);
router.delete('/:parentId',parentController.delete);
router.put('/update/:parentId',parentController.update);
router.post('/getByUsername',parentController.getStudentByUsername);
router.get('/getAll',parentController.getAllParents);
router.get('/getById/:parentId',parentController.getParentById);
router.get('/dashboard/:studentId',parentController.getDashboardData);
router.get('/dashboard/assess/:studentId',parentController.getAssessmentScore);
router.get('/dashboard/leaderboard/:studentId',parentController.getLeaderboard);
router.get('/upcoming-classes/:studentId', parentController.getUpcomingClasses);
// router.post('/upload-image', parentController.uploadImage);
router.get('/profileImage/:parentId', parentController.getProfileImage);
router.post('/upload-image', parentController.uploadImage);






module.exports = router;
