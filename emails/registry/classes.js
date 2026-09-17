'use strict';

const { defineEvent } = require('./schema');

/**
 * Scheduling and attendance.
 *
 * Anchor sites: controllers/classSchedule.js, makeupclass.js, attendance.js,
 * leave.js, Schedular/teacherNoShow.js, autoEndSessions.js
 */

const sampleSession = {
    id: 120,
    title: 'Algebra — Week 4',
    date: '2026-03-18',
    startTime: '16:00:00',
    endTime: '17:00:00',
    meetingLink: 'https://call.example.com/lms-120',
};
const sampleStudent = { id: 7, firstName: 'Ayesha', lastName: 'Khan' };
const sampleTeacher = { id: 3, firstName: 'Bilal', lastName: 'Ahmed' };

module.exports = [
    defineEvent({
        key: 'class.scheduled',
        category: 'classes',
        label: 'New class scheduled',
        description: 'Sent when a new session is added to a student or teacher schedule.',
        defaultEnabled: true,
        audiences: ['student', 'parent', 'teacher'],
        template: 'classes/scheduled',
        entityType: 'session',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: { session: sampleSession, student: sampleStudent, teacher: sampleTeacher },
    }),

    defineEvent({
        key: 'class.rescheduled',
        category: 'classes',
        label: 'Class rescheduled',
        description: 'Sent when the date, time or link of an existing session changes.',
        defaultEnabled: true,
        audiences: ['student', 'parent', 'teacher'],
        template: 'classes/rescheduled',
        entityType: 'session',
        // The bucket includes the new start time, so a session moved twice
        // produces two notices rather than silently suppressing the second.
        dedupScope: 'period',
        priority: 2,
        samplePayload: {
            session: sampleSession,
            previous: { date: '2026-03-17', startTime: '15:00:00' },
            student: sampleStudent,
            teacher: sampleTeacher,
        },
    }),

    defineEvent({
        key: 'class.cancelled',
        category: 'classes',
        label: 'Class cancelled',
        description: 'Sent to everyone attached to a session when it is cancelled.',
        defaultEnabled: true,
        audiences: ['student', 'parent', 'teacher'],
        template: 'classes/cancelled',
        entityType: 'session',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: {
            session: { ...sampleSession, status: 'cancelled', cancellationReason: 'Teacher unwell' },
            student: sampleStudent,
            teacher: sampleTeacher,
        },
    }),

    defineEvent({
        key: 'class.deleted',
        category: 'classes',
        label: 'Session deleted',
        description: 'Sent when a scheduled session is removed entirely.',
        defaultEnabled: true,
        audiences: ['student', 'parent', 'teacher'],
        template: 'classes/deleted',
        entityType: 'session',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: { session: sampleSession, student: sampleStudent, teacher: sampleTeacher },
    }),

    defineEvent({
        key: 'class.teacher_assigned',
        category: 'classes',
        label: 'Assigned to a session',
        description: 'Tells a teacher they have been assigned to teach a session.',
        defaultEnabled: true,
        audiences: ['teacher'],
        template: 'classes/teacherAssigned',
        entityType: 'session',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: { session: sampleSession, teacher: sampleTeacher },
    }),

    defineEvent({
        key: 'class.teacher_unassigned',
        category: 'classes',
        label: 'Removed from a session',
        description: 'Tells a teacher they are no longer assigned to a session.',
        defaultEnabled: true,
        audiences: ['teacher'],
        template: 'classes/teacherUnassigned',
        entityType: 'session',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: { session: sampleSession, teacher: sampleTeacher },
    }),

    defineEvent({
        key: 'class.teacher_changed',
        category: 'classes',
        label: 'Session teacher changed',
        description: 'Tells the family that a different teacher will take an upcoming class.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'classes/teacherChanged',
        entityType: 'session',
        dedupScope: 'period',
        priority: 3,
        samplePayload: {
            session: sampleSession,
            student: sampleStudent,
            teacher: sampleTeacher,
            previousTeacher: { firstName: 'Hina', lastName: 'Raza' },
        },
    }),

    defineEvent({
        key: 'class.teacher_no_show',
        category: 'classes',
        label: 'Teacher no-show',
        description: 'Critical alert to admins when a session has not started well past its time.',
        defaultEnabled: true,
        audiences: ['admin'],
        template: 'classes/teacherNoShow',
        entityType: 'session',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: { session: sampleSession, teacher: sampleTeacher, overdueMinutes: 10 },
    }),

    defineEvent({
        key: 'class.starting_late',
        category: 'classes',
        label: 'Class starting late',
        description: 'Tells the family their class has not begun on time.',
        defaultEnabled: false,
        audiences: ['student', 'parent'],
        template: 'classes/startingLate',
        entityType: 'session',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: { session: sampleSession, student: sampleStudent, teacher: sampleTeacher },
    }),

    defineEvent({
        key: 'class.student_late',
        category: 'classes',
        label: 'Student has not joined',
        description: 'Tells the parent and admins that a student has not joined a live class.',
        defaultEnabled: true,
        audiences: ['parent', 'admin'],
        template: 'classes/studentLate',
        entityType: 'session',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: { session: sampleSession, student: sampleStudent },
    }),

    defineEvent({
        key: 'class.marked_absent',
        category: 'classes',
        label: 'Marked absent',
        description: 'Tells the parent their child was marked absent from a class.',
        defaultEnabled: true,
        audiences: ['parent'],
        template: 'classes/markedAbsent',
        entityType: 'attendance',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: { session: sampleSession, student: sampleStudent, date: '2026-03-18' },
    }),

    defineEvent({
        key: 'makeup.requested',
        category: 'classes',
        label: 'Makeup class requested',
        description: 'Alerts admins that a makeup class has been proposed and needs approval.',
        defaultEnabled: true,
        audiences: ['admin'],
        template: 'classes/makeupRequested',
        entityType: 'makeup',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            makeup: { id: 8, date: '2026-03-22', time: '17:00' },
            student: sampleStudent,
            teacher: sampleTeacher,
        },
    }),

    defineEvent({
        key: 'makeup.approved',
        category: 'classes',
        label: 'Makeup class approved',
        description: 'Confirms an approved makeup class to the teacher and the family.',
        defaultEnabled: true,
        audiences: ['student', 'parent', 'teacher'],
        template: 'classes/makeupApproved',
        entityType: 'makeup',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            makeup: { id: 8, date: '2026-03-22', time: '17:00' },
            student: sampleStudent,
            teacher: sampleTeacher,
        },
    }),

    defineEvent({
        key: 'makeup.rejected',
        category: 'classes',
        label: 'Makeup class rejected',
        description: 'Tells the requesting teacher their makeup class was not approved.',
        defaultEnabled: true,
        audiences: ['teacher'],
        template: 'classes/makeupRejected',
        entityType: 'makeup',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            makeup: { id: 8, date: '2026-03-22', time: '17:00', adminReason: 'Clashes with another class' },
            teacher: sampleTeacher,
        },
    }),

    defineEvent({
        key: 'leave.teacher_logged',
        category: 'classes',
        label: 'Teacher on leave',
        description: 'Tells affected families, and admins, that a teacher is on leave.',
        defaultEnabled: true,
        audiences: ['student', 'parent', 'admin'],
        template: 'classes/teacherOnLeave',
        entityType: 'leave',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: {
            leave: { id: 4, startDate: '2026-03-20', endDate: '2026-03-22' },
            teacher: sampleTeacher,
            affectedSessions: 3,
        },
    }),

    defineEvent({
        key: 'leave.student_logged',
        category: 'classes',
        label: 'Student on leave',
        description: 'Confirms a logged student absence to the parent and the assigned teachers.',
        defaultEnabled: true,
        audiences: ['parent', 'teacher', 'admin'],
        template: 'classes/studentOnLeave',
        entityType: 'leave',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            leave: { id: 4, startDate: '2026-03-20', endDate: '2026-03-22' },
            student: sampleStudent,
            affectedSessions: 2,
        },
    }),

    defineEvent({
        key: 'class.session_auto_ended',
        category: 'classes',
        label: 'Session auto-ended',
        description: 'Alerts admins when a live session was closed automatically after everyone left.',
        defaultEnabled: false,
        audiences: ['admin'],
        template: 'classes/sessionAutoEnded',
        entityType: 'session',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: { session: sampleSession, teacher: sampleTeacher },
    }),
];
