const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/classSchedule');
const isAuth = require('../middleware/is-auth');
const checkPermission = require('../middleware/check-permission');
const { PERMISSIONS } = require('../config/permissions');

// Admin: create a schedule (recurring or one-off)
router.post('/', isAuth, ctrl.createSchedule);

// Teacher: propose a session (goes to admin for approval)
router.post('/propose', isAuth, ctrl.proposeSession);

// All roles: unified calendar events feed
router.get('/events', isAuth, ctrl.getCalendarEvents);

// Admin: list ClassSession rows for table view (synced with calendar)
router.get('/sessions-list', isAuth, checkPermission(PERMISSIONS.SCHEDULE_VIEW), ctrl.getSessionsList);

// Admin: teacher availability for a given date+time window
router.get('/teacher-availability', isAuth, checkPermission(PERMISSIONS.SCHEDULE_VIEW), ctrl.getTeacherAvailability);

// Admin: get all schedules
router.get('/admin/all', isAuth, checkPermission(PERMISSIONS.SCHEDULE_VIEW), ctrl.getAllSchedules);

// Admin: get pending teacher proposals
router.get('/admin/pending', isAuth, checkPermission(PERMISSIONS.SCHEDULE_VIEW), ctrl.getAdminPendingApprovals);

// Teacher: get own schedules
router.get('/teacher/:teacherId', isAuth, ctrl.getTeacherSchedules);

// Student: get own schedules
router.get('/student/:studentId', isAuth, ctrl.getStudentSchedules);

// Specific sub-resource routes MUST come before wildcard /:id routes

// Admin: edit safe fields of a single session (scheduled+idle only)
router.put('/sessions/:sessionId', isAuth, checkPermission(PERMISSIONS.SCHEDULE_MANAGE), ctrl.updateSession);

// Admin/Teacher: cancel a single session
router.put('/sessions/:sessionId/cancel', isAuth, ctrl.cancelSession);

// Calling integration — order matters: specific sub-paths before bare /:sessionId
router.post('/sessions/:sessionId/join', isAuth, ctrl.joinSession);
router.post('/sessions/:sessionId/start', isAuth, ctrl.startSession);
router.post('/sessions/:sessionId/end', isAuth, ctrl.endSession);

// Get single session detail
router.get('/sessions/:sessionId', isAuth, ctrl.getSession);

// Admin: approve a teacher proposal  (wildcard /:id — keep after specific paths)
router.put('/:id/approve', isAuth, checkPermission(PERMISSIONS.SCHEDULE_MANAGE), ctrl.approveSchedule);

// Admin: cancel entire schedule + all future sessions
router.put('/:id/cancel', isAuth, ctrl.cancelSchedule);

module.exports = router;
