'use strict';

const { defineEvent } = require('./schema');

/**
 * Scheduled reminders, materialized by Schedular/emailReminders.js.
 *
 * One event per reminder KIND, not per lead time. `reminder.class_upcoming`
 * carries leadTimesMinutes: [1440, 60] and the lead time becomes part of the
 * dedup bucket rather than a separate event key. That is what makes the lead
 * times cheap to configure: adding a value in the admin UI creates a new bucket
 * with zero code change, and cannot re-send the buckets that already went out.
 *
 * Every event here is dedupScope 'period' for that reason.
 *
 * These are never enqueued far in advance. A job sitting in a queue for seven
 * days is a stale snapshot of an amount and a date an admin may have edited
 * since; the materializer re-derives from live tables every 15 minutes and the
 * dedup key makes re-deriving free.
 */

const sampleStudent = { id: 7, firstName: 'Ayesha', lastName: 'Khan' };
const sampleTeacher = { id: 3, firstName: 'Bilal', lastName: 'Ahmed' };

module.exports = [
    defineEvent({
        key: 'reminder.class_upcoming',
        category: 'reminders',
        label: 'Upcoming class reminder',
        description: 'Reminds students, parents and teachers before a class starts.',
        defaultEnabled: true,
        audiences: ['student', 'parent', 'teacher'],
        template: 'reminders/classUpcoming',
        entityType: 'session',
        dedupScope: 'period',
        priority: 3,
        // The bucket also includes the session's scheduled start, so moving a
        // class produces a fresh bucket and the reminder correctly fires again.
        config: { leadTimesMinutes: [1440, 60] },
        samplePayload: {
            session: {
                id: 120,
                title: 'Algebra — Week 4',
                date: '2026-03-18',
                startTime: '16:00:00',
                meetingLink: 'https://call.example.com/lms-120',
            },
            student: sampleStudent,
            teacher: sampleTeacher,
            leadMinutes: 60,
        },
    }),

    defineEvent({
        key: 'reminder.fee_due',
        category: 'reminders',
        label: 'Fee due reminder',
        description: 'Reminds the family at each configured interval before a fee falls due.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'reminders/feeDue',
        entityType: 'fee',
        dedupScope: 'period',
        priority: 2,
        config: { leadTimesDays: [7, 3, 1] },
        samplePayload: {
            fee: { id: 42, title: 'March Tuition', amount: '4500.00', dueDate: '2026-03-15' },
            student: sampleStudent,
            leadDays: 3,
        },
    }),

    defineEvent({
        key: 'reminder.assignment_due',
        category: 'reminders',
        label: 'Assignment due reminder',
        description: 'Reminds students and parents before an assignment deadline.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'reminders/assignmentDue',
        entityType: 'assignment',
        dedupScope: 'period',
        priority: 3,
        config: { leadTimesDays: [1] },
        samplePayload: {
            assignment: { id: 31, title: 'Quadratic equations worksheet', dueDate: '2026-03-25' },
            student: sampleStudent,
            leadDays: 1,
        },
    }),

    defineEvent({
        key: 'reminder.salary_due',
        category: 'reminders',
        label: 'Salary due reminder',
        description: 'Reminds admins before teacher salary payments fall due.',
        defaultEnabled: false,
        audiences: ['admin'],
        template: 'reminders/salaryDue',
        entityType: 'salary',
        dedupScope: 'period',
        priority: 2,
        config: { leadTimesDays: [3] },
        samplePayload: {
            salary: { id: 5, amount: '60000.00', month: '2026-03', dueDate: '2026-03-31' },
            teacher: sampleTeacher,
            leadDays: 3,
        },
    }),

    defineEvent({
        key: 'reminder.missing_lesson',
        category: 'reminders',
        label: 'Missing lesson content reminder',
        description: 'Reminds a teacher that this week of lesson content is still not uploaded.',
        defaultEnabled: false,
        audiences: ['teacher'],
        template: 'reminders/missingLesson',
        entityType: 'course_detail',
        dedupScope: 'period',
        priority: 3,
        samplePayload: {
            weekNumber: 4,
            course: { courseName: 'Mathematics Grade 8' },
            teacher: sampleTeacher,
        },
    }),

    defineEvent({
        key: 'reminder.session_feedback_pending',
        category: 'reminders',
        label: 'Session feedback reminder',
        description: 'Asks a student to rate a class they attended but have not reviewed.',
        defaultEnabled: false,
        audiences: ['student'],
        template: 'reminders/sessionFeedbackPending',
        entityType: 'session',
        dedupScope: 'period',
        priority: 4,
        samplePayload: {
            session: { id: 120, title: 'Algebra — Week 4', date: '2026-03-18' },
            student: sampleStudent,
        },
    }),
];
