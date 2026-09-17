'use strict';

const { defineEvent } = require('./schema');

/**
 * Periodic summaries, built by Schedular/emailDigests.js.
 *
 * These are the only events with fanOut 'per-recipient': one email per person
 * covering many entities, rather than one email per entity. A parent with two
 * children gets a single weekly report that loops over both, not two reports.
 *
 * Priority 4 — digests always yield to transactional mail. If the queue is
 * backed up, a password reset must not wait behind 300 weekly reports.
 *
 * All four default to disabled. They are the highest-volume events in the
 * system and should only start once the pipeline has been watched for a while.
 */

module.exports = [
    defineEvent({
        key: 'digest.admin_ops_daily',
        category: 'digests',
        label: 'Daily operations digest (admin)',
        description: 'One morning summary to admins: overdue fees and salaries, no-shows, pending approvals and missing content.',
        defaultEnabled: false,
        audiences: ['admin'],
        fanOut: 'per-recipient',
        template: 'digests/adminOpsDaily',
        entityType: 'digest',
        dedupScope: 'period',
        priority: 4,
        config: { sendHour: 7 },
        samplePayload: {
            date: '2026-03-18',
            overdueFees: { count: 4, total: '18000.00' },
            overdueSalaries: { count: 1 },
            noShows: 0,
            pendingApprovals: { assignments: 2, quizzes: 1 },
            missingContent: 3,
            failedPayments: 1,
        },
    }),

    defineEvent({
        key: 'digest.parent_progress_weekly',
        category: 'digests',
        label: 'Weekly progress report (parent)',
        description: 'Per-child weekly summary of attendance, grades, upcoming classes and fee status.',
        defaultEnabled: false,
        audiences: ['parent'],
        fanOut: 'per-recipient',
        template: 'digests/parentProgressWeekly',
        entityType: 'digest',
        dedupScope: 'period',
        priority: 4,
        // 0 = Sunday, matching ClassSchedule.daysOfWeek in this codebase.
        config: { sendDay: 0, sendHour: 18 },
        samplePayload: {
            weekLabel: '9–15 March 2026',
            children: [{
                student: { id: 7, firstName: 'Ayesha', lastName: 'Khan' },
                attendance: { present: 4, absent: 1, late: 0 },
                grades: [{ title: 'Chapter 4 review', score: 76 }],
                upcoming: [{ title: 'Algebra — Week 5', date: '2026-03-18', startTime: '16:00:00' }],
                fees: { outstanding: '4500.00', overdue: false },
            }],
        },
    }),

    defineEvent({
        key: 'digest.teacher_schedule_weekly',
        category: 'digests',
        label: 'Weekly schedule digest (teacher)',
        description: 'Each teacher’s upcoming week of sessions plus anything awaiting their action.',
        defaultEnabled: false,
        audiences: ['teacher'],
        fanOut: 'per-recipient',
        template: 'digests/teacherScheduleWeekly',
        entityType: 'digest',
        dedupScope: 'period',
        priority: 4,
        config: { sendDay: 0, sendHour: 18 },
        samplePayload: {
            weekLabel: '16–22 March 2026',
            teacher: { id: 3, firstName: 'Bilal', lastName: 'Ahmed' },
            sessions: [{ title: 'Algebra — Week 5', date: '2026-03-18', startTime: '16:00:00' }],
            pending: { contentWeeks: [5], ungradedAssignments: 3 },
        },
    }),

    defineEvent({
        key: 'digest.revenue_monthly',
        category: 'digests',
        label: 'Monthly revenue summary (admin)',
        description: 'Month-end collections, outstanding fees and salary spend for admins.',
        defaultEnabled: false,
        audiences: ['admin'],
        fanOut: 'per-recipient',
        template: 'digests/revenueMonthly',
        entityType: 'digest',
        dedupScope: 'period',
        priority: 4,
        config: { sendDayOfMonth: 1, sendHour: 8 },
        samplePayload: {
            monthLabel: 'March 2026',
            collected: '412000.00',
            outstanding: '58000.00',
            overdueCount: 6,
            salariesPaid: '240000.00',
            newStudents: 9,
        },
    }),
];
