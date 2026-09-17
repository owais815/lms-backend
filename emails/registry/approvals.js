'use strict';

const { defineEvent } = require('./schema');

/**
 * Teacher <-> admin workflow. Mostly internal staff traffic, so several of
 * these default to disabled: admins already see them in-app, and the daily ops
 * digest covers the same ground without one email per item.
 *
 * Support requests are the exception — they had no notification of any kind
 * before, in-app or otherwise, so a request could sit unseen indefinitely.
 *
 * Anchor sites: controllers/assignment.js, quiz.js, weeklyContent.js,
 * supportRequestController.js, Schedular/staleApprovals.js, checkMissingLessons.js
 */

const sampleTeacher = { id: 3, firstName: 'Bilal', lastName: 'Ahmed' };

module.exports = [
    defineEvent({
        key: 'approval.assignment_pending',
        category: 'approvals',
        label: 'Assignment awaiting approval',
        description: 'Alerts admins that a teacher has submitted an assignment for review.',
        defaultEnabled: false,
        audiences: ['admin'],
        template: 'approvals/assignmentPending',
        entityType: 'assignment',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            assignment: { id: 31, title: 'Quadratic equations worksheet' },
            teacher: sampleTeacher,
        },
    }),

    defineEvent({
        key: 'approval.assignment_decided',
        category: 'approvals',
        label: 'Assignment approved or rejected',
        description: 'Tells the submitting teacher the outcome of their assignment review.',
        defaultEnabled: true,
        audiences: ['teacher'],
        template: 'approvals/assignmentDecided',
        entityType: 'assignment',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            assignment: { id: 31, title: 'Quadratic equations worksheet' },
            approved: true,
            teacher: sampleTeacher,
        },
    }),

    defineEvent({
        key: 'approval.quiz_pending',
        category: 'approvals',
        label: 'Quiz awaiting approval',
        description: 'Alerts admins that a teacher has submitted a quiz for review.',
        defaultEnabled: false,
        audiences: ['admin'],
        template: 'approvals/quizPending',
        entityType: 'quiz',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: { quiz: { id: 12, title: 'Chapter 4 review' }, teacher: sampleTeacher },
    }),

    defineEvent({
        key: 'approval.quiz_decided',
        category: 'approvals',
        label: 'Quiz approved or rejected',
        description: 'Tells the submitting teacher the outcome of their quiz review.',
        defaultEnabled: true,
        audiences: ['teacher'],
        template: 'approvals/quizDecided',
        entityType: 'quiz',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            quiz: { id: 12, title: 'Chapter 4 review' },
            approved: false,
            teacher: sampleTeacher,
        },
    }),

    defineEvent({
        key: 'approval.session_proposal_pending',
        category: 'approvals',
        label: 'Session proposal awaiting approval',
        description: 'Alerts admins that a teacher has proposed a new session.',
        defaultEnabled: false,
        audiences: ['admin'],
        template: 'approvals/sessionProposalPending',
        entityType: 'schedule',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: { schedule: { id: 55, title: 'Extra revision class' }, teacher: sampleTeacher },
    }),

    defineEvent({
        key: 'approval.session_proposal_decided',
        category: 'approvals',
        label: 'Session proposal approved',
        description: 'Tells the proposing teacher their session was approved.',
        defaultEnabled: true,
        audiences: ['teacher'],
        template: 'approvals/sessionProposalDecided',
        entityType: 'schedule',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            schedule: { id: 55, title: 'Extra revision class' },
            approved: true,
            teacher: sampleTeacher,
        },
    }),

    defineEvent({
        key: 'approval.content_decided',
        category: 'approvals',
        label: 'Lesson content reviewed',
        description: 'Tells the teacher whether their weekly content was approved or needs edits.',
        defaultEnabled: true,
        audiences: ['teacher'],
        template: 'approvals/contentDecided',
        entityType: 'weekly_content',
        dedupScope: 'entity+day',
        priority: 3,
        samplePayload: {
            content: { id: 15, weekNumber: 4 },
            approved: false,
            note: 'Please add the practice exercises.',
            teacher: sampleTeacher,
        },
    }),

    defineEvent({
        key: 'approval.stale',
        category: 'approvals',
        label: 'Approval waiting too long',
        description: 'Reminds admins about assignments or quizzes left unreviewed for hours.',
        defaultEnabled: false,
        audiences: ['admin'],
        template: 'approvals/stale',
        entityType: 'approval',
        // entity+day, because the underlying cron re-checks hourly and the
        // in-memory dedup it uses today resets on every deploy restart.
        dedupScope: 'entity+day',
        priority: 3,
        samplePayload: { kind: 'assignment', title: 'Quadratic equations worksheet', hours: 26 },
    }),

    defineEvent({
        key: 'approval.content_missing',
        category: 'approvals',
        label: 'Lesson content missing',
        description: 'Tells the teacher, and admins, that a week of content has not been uploaded.',
        defaultEnabled: false,
        audiences: ['teacher', 'admin'],
        template: 'approvals/contentMissing',
        entityType: 'course_detail',
        dedupScope: 'entity+day',
        priority: 3,
        samplePayload: {
            weekNumber: 4,
            course: { courseName: 'Mathematics Grade 8' },
            student: { firstName: 'Ayesha', lastName: 'Khan' },
            teacher: sampleTeacher,
        },
    }),

    defineEvent({
        key: 'support.request_created',
        category: 'approvals',
        label: 'Support request raised',
        description: 'Alerts admins that a user has raised a support request.',
        defaultEnabled: true,
        audiences: ['admin'],
        template: 'approvals/supportRequestCreated',
        entityType: 'support_request',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: {
            request: { id: 77, title: 'Cannot join my class', priority: 'high' },
            requesterName: 'Ayesha Khan',
            requesterType: 'student',
        },
    }),

    defineEvent({
        key: 'support.request_answered',
        category: 'approvals',
        label: 'Support request answered',
        description: 'Sends the admin response back to whoever raised the request.',
        defaultEnabled: true,
        audiences: ['student', 'parent', 'teacher'],
        template: 'approvals/supportRequestAnswered',
        entityType: 'support_request',
        dedupScope: 'entity+day',
        priority: 2,
        samplePayload: {
            request: {
                id: 77,
                title: 'Cannot join my class',
                responseFromAdmin: 'Please try the link again — it has been reset.',
                status: 'resolved',
            },
        },
    }),

    defineEvent({
        key: 'feedback.low_rating',
        category: 'approvals',
        label: 'Low session rating',
        description: 'Alerts admins when a student rates a session poorly.',
        defaultEnabled: true,
        audiences: ['admin'],
        template: 'approvals/lowRating',
        entityType: 'session_feedback',
        dedupScope: 'entity',
        priority: 2,
        config: { thresholdRating: 3 },
        samplePayload: {
            session: { id: 120, title: 'Algebra — Week 4' },
            rating: 2,
            comment: 'Audio kept cutting out.',
        },
    }),
];
