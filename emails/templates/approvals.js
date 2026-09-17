'use strict';

/**
 * Teacher/admin workflow templates.
 */

const { h } = require('./escape');
const { p, panel, infoRow, button, callout, muted } = require('./components');

const reviewButton = (ctx, path, label = 'Review') =>
    button(label, `${ctx.appUrl}${path}`, ctx.primaryColor);

module.exports = {
    assignmentPending: {
        subject: (d) => `Assignment awaiting approval — ${d.assignment.title}`,
        preheader: (d) => `Submitted by ${d.ctx.name(d.teacher)}.`,
        html: (d) => h`
${p(h`<strong>${d.ctx.name(d.teacher)}</strong> has submitted an assignment for approval.`)}
${panel([
    infoRow('Assignment', d.assignment.title),
    infoRow('Teacher', d.ctx.name(d.teacher)),
])}
${reviewButton(d.ctx, '/assignments', 'Review assignment')}`,
    },

    assignmentDecided: {
        subject: (d) => d.approved
            ? `Approved: ${d.assignment.title}`
            : `Changes needed: ${d.assignment.title}`,
        preheader: (d) => d.approved ? 'Your assignment is now live for students.' : 'Your assignment needs revision.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.teacher)},`)}
${d.approved
    ? callout(h`<strong>${d.assignment.title}</strong> has been approved and is now visible to students.`, 'success')
    : callout(h`<strong>${d.assignment.title}</strong> was not approved. Please review and resubmit.`, 'warning')}
${reviewButton(d.ctx, '/teacher/assignments', 'Open assignments')}`,
    },

    quizPending: {
        subject: (d) => `Quiz awaiting approval — ${d.quiz.title}`,
        preheader: (d) => `Submitted by ${d.ctx.name(d.teacher)}.`,
        html: (d) => h`
${p(h`<strong>${d.ctx.name(d.teacher)}</strong> has submitted a quiz for approval.`)}
${panel([
    infoRow('Quiz', d.quiz.title),
    infoRow('Teacher', d.ctx.name(d.teacher)),
])}
${reviewButton(d.ctx, '/quizzes', 'Review quiz')}`,
    },

    quizDecided: {
        subject: (d) => d.approved ? `Approved: ${d.quiz.title}` : `Changes needed: ${d.quiz.title}`,
        preheader: (d) => d.approved ? 'Your quiz is now live for students.' : 'Your quiz needs revision.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.teacher)},`)}
${d.approved
    ? callout(h`<strong>${d.quiz.title}</strong> has been approved and is now visible to students.`, 'success')
    : callout(h`<strong>${d.quiz.title}</strong> was not approved. Please review and resubmit.`, 'warning')}
${reviewButton(d.ctx, '/teacher/quizzes', 'Open quizzes')}`,
    },

    sessionProposalPending: {
        subject: (d) => `Session proposal — ${d.schedule.title}`,
        preheader: (d) => `Proposed by ${d.ctx.name(d.teacher)}.`,
        html: (d) => h`
${p(h`<strong>${d.ctx.name(d.teacher)}</strong> has proposed a new session.`)}
${panel([
    infoRow('Session', d.schedule.title),
    infoRow('Teacher', d.ctx.name(d.teacher)),
])}
${reviewButton(d.ctx, '/schedule', 'Review proposal')}`,
    },

    sessionProposalDecided: {
        subject: (d) => d.approved ? `Approved: ${d.schedule.title}` : `Not approved: ${d.schedule.title}`,
        preheader: (d) => d.approved ? 'Your proposed session is confirmed.' : 'Your proposed session was declined.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.teacher)},`)}
${d.approved
    ? callout(h`Your proposed session <strong>${d.schedule.title}</strong> has been approved.`, 'success')
    : callout(h`Your proposed session <strong>${d.schedule.title}</strong> was not approved.`, 'warning')}
${reviewButton(d.ctx, '/teacher/schedule', 'View your schedule')}`,
    },

    contentDecided: {
        subject: (d) => d.approved
            ? `Week ${d.content.weekNumber} content approved`
            : `Week ${d.content.weekNumber} content needs edits`,
        preheader: (d) => d.approved ? 'Your lesson content is live.' : 'Your lesson content needs changes.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.teacher)},`)}
${d.approved
    ? callout(h`Your content for <strong>Week ${String(d.content.weekNumber)}</strong> has been approved.`, 'success')
    : callout(h`Your content for <strong>Week ${String(d.content.weekNumber)}</strong> needs some edits.`, 'warning')}
${!d.approved && d.note ? panel([infoRow('Note', d.note)]) : ''}
${reviewButton(d.ctx, '/teacher/content', 'Open lesson content')}`,
    },

    stale: {
        subject: (d) => `Waiting ${d.hours}h for approval: ${d.title}`,
        preheader: (d) => `This ${d.kind} has not been reviewed yet.`,
        html: (d) => h`
${callout(h`<strong>${d.title}</strong> has been waiting for approval for ${String(d.hours)} hours.`, 'warning')}
${panel([
    infoRow('Type', d.kind),
    infoRow('Item', d.title),
    infoRow('Waiting', `${d.hours} hours`),
])}
${reviewButton(d.ctx, '/assignments', 'Review pending items')}`,
    },

    contentMissing: {
        subject: (d) => `Week ${d.weekNumber} content not uploaded`,
        preheader: (d) => d.course ? `${d.course.courseName} — week ${d.weekNumber}.` : 'Lesson content is missing.',
        html: (d) => h`
${callout(h`Content for <strong>Week ${String(d.weekNumber)}</strong>${d.course ? h` of ${d.course.courseName}` : ''} has not been uploaded yet.`, 'warning')}
${panel([
    ...(d.teacher ? [infoRow('Teacher', d.ctx.name(d.teacher))] : []),
    ...(d.student ? [infoRow('Student', d.ctx.name(d.student))] : []),
    infoRow('Week', String(d.weekNumber)),
])}
${reviewButton(d.ctx, '/teacher/content', 'Upload content')}`,
    },

    supportRequestCreated: {
        subject: (d) => `Support request: ${d.request.title}`,
        preheader: (d) => `Raised by ${d.requesterName || 'a user'}.`,
        html: (d) => h`
${p(h`A support request has been raised${d.requesterName ? h` by <strong>${d.requesterName}</strong>` : ''}.`)}
${panel([
    infoRow('Subject', d.request.title),
    ...(d.requesterName ? [infoRow('From', `${d.requesterName}${d.requesterType ? ` (${d.requesterType})` : ''}`)] : []),
    ...(d.request.priority ? [infoRow('Priority', d.request.priority)] : []),
])}
${reviewButton(d.ctx, '/support', 'Open support requests')}`,
    },

    supportRequestAnswered: {
        subject: (d) => `Re: ${d.request.title}`,
        preheader: () => 'We have replied to your support request.',
        html: (d) => h`
${p('We have responded to your support request.')}
${panel([
    infoRow('Subject', d.request.title),
    ...(d.request.status ? [infoRow('Status', d.request.status)] : []),
])}
${d.request.responseFromAdmin ? panel([infoRow('Our reply', d.request.responseFromAdmin)]) : ''}
${muted('If this did not resolve things, reply to this email and we will pick it up.')}`,
    },

    lowRating: {
        subject: (d) => `Low rating (${d.rating}/5) — ${d.session.title}`,
        preheader: (d) => `A student rated this session ${d.rating} out of 5.`,
        html: (d) => h`
${callout(h`<strong>${d.session.title}</strong> was rated ${String(d.rating)}/5 by a student.`, 'warning')}
${d.comment ? panel([infoRow('Comment', d.comment)]) : ''}
${reviewButton(d.ctx, '/feedback', 'Review session feedback')}`,
    },
};
