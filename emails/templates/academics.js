'use strict';

/**
 * Coursework, assessment and certificate templates.
 *
 * Several of these go to parents as well as students, because the parent is
 * usually the person who acts on a grade or a missed deadline.
 */

const { h } = require('./escape');
const { p, panel, infoRow, button, callout, muted } = require('./components');

module.exports = {
    assignmentPublished: {
        subject: (d) => `New assignment: ${d.assignment.title}`,
        preheader: (d) => d.assignment.dueDate ? `Due ${d.ctx.date(d.assignment.dueDate)}.` : 'A new assignment is available.',
        html: (d) => h`
${p(h`A new assignment has been published${d.course ? h` for <strong>${d.course.courseName}</strong>` : ''}.`)}
${panel([
    infoRow('Assignment', d.assignment.title),
    ...(d.assignment.dueDate ? [infoRow('Due', d.ctx.date(d.assignment.dueDate))] : []),
    ...(d.teacher ? [infoRow('Set by', d.ctx.name(d.teacher))] : []),
])}
${button('Open assignment', `${d.ctx.appUrl}/student/assignments`, d.ctx.primaryColor)}`,
    },

    assignmentSubmitted: {
        subject: (d) => `Submission received — ${d.assignment.title}`,
        preheader: (d) => `${d.ctx.name(d.student)} has submitted their work.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.teacher)},`)}
${p(h`<strong>${d.ctx.name(d.student)}</strong> has submitted <strong>${d.assignment.title}</strong>.`)}
${button('Review submissions', `${d.ctx.appUrl}/teacher/assignments`, d.ctx.primaryColor)}`,
    },

    assignmentGraded: {
        subject: (d) => `Graded: ${d.assignment.title}`,
        preheader: (d) => `Score: ${d.score}${d.total ? ` / ${d.total}` : ''}.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${p(h`<strong>${d.assignment.title}</strong> has been graded.`)}
${panel([
    infoRow('Assignment', d.assignment.title),
    infoRow('Score', d.total ? `${d.score} / ${d.total}` : String(d.score)),
])}
${button('See feedback', `${d.ctx.appUrl}/student/assignments`, d.ctx.primaryColor)}`,
    },

    quizPublished: {
        subject: (d) => `New quiz: ${d.quiz.title}`,
        preheader: () => 'A new quiz has been assigned to you.',
        html: (d) => h`
${p(h`A new quiz has been assigned${d.course ? h` for <strong>${d.course.courseName}</strong>` : ''}.`)}
${panel([infoRow('Quiz', d.quiz.title)])}
${button('Take the quiz', `${d.ctx.appUrl}/student/quizzes`, d.ctx.primaryColor)}`,
    },

    quizGraded: {
        subject: (d) => `Quiz result: ${d.quiz.title}`,
        preheader: (d) => `Score: ${Math.round(Number(d.score))}%.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${p(h`Your result for <strong>${d.quiz.title}</strong> is ready.`)}
${panel([
    infoRow('Quiz', d.quiz.title),
    infoRow('Score', `${Math.round(Number(d.score))}%`),
])}
${button('View results', `${d.ctx.appUrl}/student/quizzes`, d.ctx.primaryColor)}`,
    },

    quizLowScore: {
        subject: (d) => `Low quiz score — ${d.ctx.name(d.student)}`,
        preheader: (d) => `${Math.round(Number(d.score))}% on ${d.quiz.title}.`,
        html: (d) => h`
${callout(h`<strong>${d.ctx.name(d.student)}</strong> scored ${Math.round(Number(d.score))}% on <strong>${d.quiz.title}</strong>.`, 'warning')}
${p('It may be worth going over this topic again before the next assessment.')}
${button('View results', `${d.ctx.appUrl}/parent/results`, d.ctx.primaryColor)}`,
    },

    certificateIssued: {
        subject: (d) => `Certificate issued${d.course ? ` — ${d.course.courseName}` : ''}`,
        preheader: () => 'Congratulations — your certificate is ready.',
        html: (d) => h`
${p(h`Congratulations ${d.ctx.name(d.student)}!`)}
${callout(h`Your certificate${d.course ? h` for <strong>${d.course.courseName}</strong>` : ''} has been issued.`, 'success')}
${panel([
    ...(d.course ? [infoRow('Course', d.course.courseName)] : []),
    ...(d.certificate.issuedAt ? [infoRow('Issued', d.ctx.date(d.certificate.issuedAt))] : []),
])}
${button('View certificate', `${d.ctx.appUrl}/student/certificates`, d.ctx.primaryColor)}`,
    },

    certificateRevoked: {
        subject: (d) => `Certificate withdrawn${d.course ? ` — ${d.course.courseName}` : ''}`,
        preheader: () => 'A previously issued certificate has been withdrawn.',
        html: (d) => h`
${callout(h`The certificate${d.course ? h` for <strong>${d.course.courseName}</strong>` : ''} issued to <strong>${d.ctx.name(d.student)}</strong> has been withdrawn.`, 'danger')}
${muted('If you believe this is a mistake, please get in touch.')}`,
    },

    weeklyContentPublished: {
        subject: (d) => `New lesson material — Week ${d.content.weekNumber}`,
        preheader: (d) => d.course ? `${d.course.courseName}, week ${d.content.weekNumber}.` : 'New material is available.',
        html: (d) => h`
${p(h`New lesson material for <strong>Week ${String(d.content.weekNumber)}</strong>${d.course ? h` of ${d.course.courseName}` : ''} is now available.`)}
${button('Open lesson material', `${d.ctx.appUrl}/student/courses`, d.ctx.primaryColor)}`,
    },

    courseCompleted: {
        subject: (d) => `Course complete — ${d.course.courseName}`,
        preheader: () => 'Congratulations on finishing the course.',
        html: (d) => h`
${callout(h`<strong>${d.course.courseName}</strong> has been marked complete.`, 'success')}
${panel([
    infoRow('Course', d.course.courseName),
    ...(d.student ? [infoRow('Student', d.ctx.name(d.student))] : []),
    ...(d.teacher ? [infoRow('Teacher', d.ctx.name(d.teacher))] : []),
])}
${muted('Any certificate for this course will follow separately.')}`,
    },

    resourceShared: {
        subject: (d) => `New resource: ${d.resource.title}`,
        preheader: () => 'A new learning resource has been shared with you.',
        html: (d) => h`
${p(h`A new resource has been shared${d.course ? h` for <strong>${d.course.courseName}</strong>` : ''}.`)}
${panel([infoRow('Resource', d.resource.title)])}
${button('Open resources', `${d.ctx.appUrl}/student/resources`, d.ctx.primaryColor)}`,
    },

    feedbackResponded: {
        subject: () => 'Your teacher replied to your feedback',
        preheader: (d) => d.teacher ? `${d.ctx.name(d.teacher)} has responded.` : 'You have a reply.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${p(h`${d.teacher ? d.ctx.name(d.teacher) : 'Your teacher'} has replied to the feedback you submitted.`)}
${d.feedback.response ? panel([infoRow('Reply', d.feedback.response)]) : ''}
${button('View feedback', `${d.ctx.appUrl}/student/feedback`, d.ctx.primaryColor)}`,
    },
};
