'use strict';

const { defineEvent } = require('./schema');

/**
 * Coursework, assessment and certificates.
 *
 * Note the audience difference from the in-app equivalents: most of these fire
 * in-app to the student only, but parents are the people who actually act on a
 * grade or a missed assignment, so they are included here.
 *
 * Anchor sites: controllers/assignment.js, quiz.js, certificate.js,
 * weeklyContent.js, courseDetails.js
 */

const sampleStudent = { id: 7, firstName: 'Ayesha', lastName: 'Khan' };
const sampleTeacher = { id: 3, firstName: 'Bilal', lastName: 'Ahmed' };
const sampleCourse = { id: 2, courseName: 'Mathematics Grade 8' };

module.exports = [
    defineEvent({
        key: 'assignment.published',
        category: 'academics',
        label: 'New assignment published',
        description: 'Tells students and parents a new assignment is available.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'academics/assignmentPublished',
        entityType: 'assignment',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            assignment: { id: 31, title: 'Quadratic equations worksheet', dueDate: '2026-03-25' },
            student: sampleStudent,
            teacher: sampleTeacher,
            course: sampleCourse,
        },
    }),

    defineEvent({
        key: 'assignment.submitted',
        category: 'academics',
        label: 'Assignment submitted',
        description: 'Tells the teacher a student has submitted their work.',
        defaultEnabled: false,
        audiences: ['teacher'],
        template: 'academics/assignmentSubmitted',
        entityType: 'assignment',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            assignment: { id: 31, title: 'Quadratic equations worksheet' },
            student: sampleStudent,
            teacher: sampleTeacher,
        },
    }),

    defineEvent({
        key: 'assignment.graded',
        category: 'academics',
        label: 'Assignment graded',
        description: 'Sends the score to the student and parent once an assignment is marked.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'academics/assignmentGraded',
        entityType: 'assignment',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            assignment: { id: 31, title: 'Quadratic equations worksheet' },
            score: 18,
            total: 20,
            student: sampleStudent,
        },
    }),

    defineEvent({
        key: 'quiz.published',
        category: 'academics',
        label: 'New quiz available',
        description: 'Tells students and parents a new quiz has been assigned.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'academics/quizPublished',
        entityType: 'quiz',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            quiz: { id: 12, title: 'Chapter 4 review' },
            student: sampleStudent,
            course: sampleCourse,
        },
    }),

    defineEvent({
        key: 'quiz.graded',
        category: 'academics',
        label: 'Quiz result available',
        description: 'Sends the quiz score to the student and parent after an attempt is marked.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'academics/quizGraded',
        entityType: 'quiz_attempt',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            quiz: { id: 12, title: 'Chapter 4 review' },
            score: 76,
            student: sampleStudent,
        },
    }),

    defineEvent({
        key: 'quiz.low_score',
        category: 'academics',
        label: 'Low quiz score alert',
        description: 'Flags a below-threshold quiz result to the parent and the teacher.',
        defaultEnabled: false,
        audiences: ['parent', 'teacher'],
        template: 'academics/quizLowScore',
        entityType: 'quiz_attempt',
        dedupScope: 'entity',
        priority: 3,
        config: { thresholdPercent: 50 },
        samplePayload: {
            quiz: { id: 12, title: 'Chapter 4 review' },
            score: 38,
            student: sampleStudent,
            teacher: sampleTeacher,
        },
    }),

    defineEvent({
        key: 'certificate.issued',
        category: 'academics',
        label: 'Certificate issued',
        description: 'Congratulates the student and tells the parent a certificate is ready.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'academics/certificateIssued',
        entityType: 'certificate',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            certificate: { id: 6, issuedAt: '2026-03-20' },
            course: sampleCourse,
            student: sampleStudent,
        },
    }),

    defineEvent({
        key: 'certificate.revoked',
        category: 'academics',
        label: 'Certificate revoked',
        description: 'Tells the family, and admins, that an issued certificate has been withdrawn.',
        defaultEnabled: true,
        audiences: ['student', 'parent', 'admin'],
        template: 'academics/certificateRevoked',
        entityType: 'certificate',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: {
            certificate: { id: 6 },
            course: sampleCourse,
            student: sampleStudent,
        },
    }),

    defineEvent({
        key: 'weekly_content.published',
        category: 'academics',
        label: 'New lesson content shared',
        description: 'Tells the family that new weekly lesson material is available.',
        defaultEnabled: true,
        audiences: ['student', 'parent'],
        template: 'academics/weeklyContentPublished',
        entityType: 'weekly_content',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            content: { id: 15, weekNumber: 4 },
            course: sampleCourse,
            student: sampleStudent,
        },
    }),

    defineEvent({
        key: 'course.completed',
        category: 'academics',
        label: 'Course completed',
        description: 'Marks the end of a course for the teacher and the family.',
        defaultEnabled: true,
        audiences: ['student', 'parent', 'teacher'],
        template: 'academics/courseCompleted',
        entityType: 'course_detail',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: { course: sampleCourse, student: sampleStudent, teacher: sampleTeacher },
    }),

    defineEvent({
        key: 'resource.shared',
        category: 'academics',
        label: 'New resource shared',
        description: 'Tells students and parents a new learning resource has been added.',
        defaultEnabled: false,
        audiences: ['student', 'parent'],
        template: 'academics/resourceShared',
        entityType: 'resource',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            resource: { id: 44, title: 'Algebra formula sheet' },
            course: sampleCourse,
            student: sampleStudent,
        },
    }),

    defineEvent({
        key: 'feedback.teacher_responded',
        category: 'academics',
        label: 'Teacher responded to feedback',
        description: 'Tells a student their teacher has replied to submitted feedback.',
        defaultEnabled: false,
        audiences: ['student'],
        template: 'academics/feedbackResponded',
        entityType: 'feedback',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            feedback: { id: 9, response: 'Thanks — we will cover this again next week.' },
            student: sampleStudent,
            teacher: sampleTeacher,
        },
    }),
];
