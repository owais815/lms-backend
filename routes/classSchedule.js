const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/classSchedule');

// Admin: create a schedule (recurring or one-off)
router.post('/', ctrl.createSchedule);

// Teacher: propose a session (goes to admin for approval)
router.post('/propose', ctrl.proposeSession);

// All roles: unified calendar events feed
// Query params: userId, role, start (ISO date), end (ISO date)
router.get('/events', ctrl.getCalendarEvents);

// Admin: get all schedules
router.get('/admin/all', ctrl.getAllSchedules);

// Admin: get pending teacher proposals
router.get('/admin/pending', ctrl.getAdminPendingApprovals);

// Teacher: get own schedules
router.get('/teacher/:teacherId', ctrl.getTeacherSchedules);

// Student: get own schedules
router.get('/student/:studentId', ctrl.getStudentSchedules);

// Admin: approve a teacher proposal
router.put('/:id/approve', ctrl.approveSchedule);

// Admin: cancel entire schedule + all future sessions
router.put('/:id/cancel', ctrl.cancelSchedule);

// Admin/Teacher: cancel a single session
router.put('/sessions/:sessionId/cancel', ctrl.cancelSession);

// Get single session detail
router.get('/sessions/:sessionId', ctrl.getSession);

module.exports = router;
