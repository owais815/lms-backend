'use strict';

/**
 * Scheduling and attendance templates.
 *
 * Times are rendered through ctx.dateAndTime(), which combines ClassSession's
 * DATEONLY `date` and TIME `startTime` columns in the recipient's own timezone.
 * A class reminder showing the wrong local time is worse than none at all.
 */

const { h } = require('./escape');
const { p, panel, infoRow, button, callout, muted } = require('./components');

const sessionRows = (session, ctx, teacher) => [
    infoRow('Class', session.title),
    infoRow('When', ctx.dateAndTime(session.date, session.startTime)),
    ...(teacher ? [infoRow('Teacher', ctx.name(teacher))] : []),
];

const joinButton = (session, ctx) =>
    session.meetingLink
        ? button('Join the class', session.meetingLink, ctx.primaryColor)
        : button('View your schedule', `${ctx.appUrl}/schedule`, ctx.primaryColor);

module.exports = {
    scheduled: {
        subject: (d) => `New class scheduled — ${d.session.title}`,
        preheader: (d) => d.ctx.dateAndTime(d.session.date, d.session.startTime),
        html: (d) => h`
${p('A new class has been added to the schedule.')}
${panel(sessionRows(d.session, d.ctx, d.teacher))}
${button('View your schedule', `${d.ctx.appUrl}/schedule`, d.ctx.primaryColor)}`,
    },

    rescheduled: {
        subject: (d) => `Rescheduled: ${d.session.title}`,
        preheader: (d) => `Now ${d.ctx.dateAndTime(d.session.date, d.session.startTime)}.`,
        html: (d) => h`
${callout(h`<strong>${d.session.title}</strong> has been moved.`, 'warning')}
${panel([
    ...(d.previous
        ? [infoRow('Was', d.ctx.dateAndTime(d.previous.date, d.previous.startTime))]
        : []),
    infoRow('Now', d.ctx.dateAndTime(d.session.date, d.session.startTime)),
    ...(d.teacher ? [infoRow('Teacher', d.ctx.name(d.teacher))] : []),
])}
${button('View your schedule', `${d.ctx.appUrl}/schedule`, d.ctx.primaryColor)}`,
    },

    cancelled: {
        subject: (d) => `Cancelled: ${d.session.title}`,
        preheader: (d) => `The class on ${d.ctx.date(d.session.date)} will not go ahead.`,
        html: (d) => h`
${callout(h`<strong>${d.session.title}</strong> on ${d.ctx.dateAndTime(d.session.date, d.session.startTime)} has been cancelled.`, 'danger')}
${d.session.cancellationReason ? panel([infoRow('Reason', d.session.cancellationReason)]) : ''}
${muted('If a makeup class is arranged, you will hear from us separately.')}
${button('View your schedule', `${d.ctx.appUrl}/schedule`, d.ctx.primaryColor)}`,
    },

    deleted: {
        subject: (d) => `Removed from schedule: ${d.session.title}`,
        preheader: (d) => `The class on ${d.ctx.date(d.session.date)} has been removed.`,
        html: (d) => h`
${p(h`<strong>${d.session.title}</strong>, scheduled for ${d.ctx.dateAndTime(d.session.date, d.session.startTime)}, has been removed from the schedule.`)}
${button('View your schedule', `${d.ctx.appUrl}/schedule`, d.ctx.primaryColor)}`,
    },

    teacherAssigned: {
        subject: (d) => `You have been assigned: ${d.session.title}`,
        preheader: (d) => d.ctx.dateAndTime(d.session.date, d.session.startTime),
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.teacher)},`)}
${p('You have been assigned to teach the following class.')}
${panel(sessionRows(d.session, d.ctx))}
${button('View your schedule', `${d.ctx.appUrl}/teacher/schedule`, d.ctx.primaryColor)}`,
    },

    teacherUnassigned: {
        subject: (d) => `You have been unassigned: ${d.session.title}`,
        preheader: (d) => `No longer scheduled for ${d.ctx.date(d.session.date)}.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.teacher)},`)}
${p(h`You are no longer assigned to <strong>${d.session.title}</strong> on ${d.ctx.dateAndTime(d.session.date, d.session.startTime)}.`)}
${muted('Check with the admin team if this is unexpected.')}`,
    },

    teacherChanged: {
        subject: (d) => `Teacher change for ${d.session.title}`,
        preheader: (d) => `${d.ctx.name(d.teacher)} will take this class.`,
        html: (d) => h`
${p('There has been a teacher change for an upcoming class.')}
${panel([
    infoRow('Class', d.session.title),
    infoRow('When', d.ctx.dateAndTime(d.session.date, d.session.startTime)),
    ...(d.previousTeacher ? [infoRow('Was', d.ctx.name(d.previousTeacher))] : []),
    infoRow('Now', d.ctx.name(d.teacher)),
])}
${button('View your schedule', `${d.ctx.appUrl}/schedule`, d.ctx.primaryColor)}`,
    },

    teacherNoShow: {
        subject: (d) => `Teacher has not started: ${d.session.title}`,
        preheader: (d) => `${d.ctx.name(d.teacher)} is ${d.overdueMinutes}+ minutes overdue.`,
        html: (d) => h`
${callout(h`<strong>${d.ctx.name(d.teacher)}</strong> has not started <strong>${d.session.title}</strong>, scheduled for ${d.ctx.dateAndTime(d.session.date, d.session.startTime)}.`, 'danger')}
${panel([
    infoRow('Teacher', d.ctx.name(d.teacher)),
    infoRow('Class', d.session.title),
    infoRow('Scheduled', d.ctx.dateAndTime(d.session.date, d.session.startTime)),
    infoRow('Overdue by', `${d.overdueMinutes}+ minutes`),
])}
${button('Open live sessions', `${d.ctx.appUrl}/schedule`, d.ctx.primaryColor)}`,
    },

    startingLate: {
        subject: (d) => `${d.session.title} is starting late`,
        preheader: () => 'Your class has not begun yet.',
        html: (d) => h`
${p(h`<strong>${d.session.title}</strong>, scheduled for ${d.ctx.dateAndTime(d.session.date, d.session.startTime)}, has not started yet.`)}
${p('We are following it up. Please stay on the line a little longer.')}
${joinButton(d.session, d.ctx)}`,
    },

    studentLate: {
        subject: (d) => `${d.ctx.name(d.student)} has not joined ${d.session.title}`,
        preheader: () => 'The class has started without them.',
        html: (d) => h`
${callout(h`<strong>${d.ctx.name(d.student)}</strong> has not joined <strong>${d.session.title}</strong>, which has already started.`, 'warning')}
${panel(sessionRows(d.session, d.ctx))}
${joinButton(d.session, d.ctx)}`,
    },

    markedAbsent: {
        subject: (d) => `${d.ctx.name(d.student)} was marked absent`,
        preheader: (d) => `${d.session ? d.session.title : 'A class'} on ${d.ctx.date(d.date)}.`,
        html: (d) => h`
${p(h`<strong>${d.ctx.name(d.student)}</strong> was marked absent from ${d.session ? h`<strong>${d.session.title}</strong>` : 'a class'} on ${d.ctx.date(d.date)}.`)}
${muted('If this is wrong, let us know and we will correct the record.')}
${button('View attendance', `${d.ctx.appUrl}/parent/attendance`, d.ctx.primaryColor)}`,
    },

    makeupRequested: {
        subject: (d) => `Makeup class to approve — ${d.ctx.name(d.student)}`,
        preheader: (d) => `Proposed for ${d.ctx.date(d.makeup.date)} at ${d.makeup.time}.`,
        html: (d) => h`
${p('A makeup class has been proposed and is waiting for approval.')}
${panel([
    infoRow('Student', d.ctx.name(d.student)),
    ...(d.teacher ? [infoRow('Teacher', d.ctx.name(d.teacher))] : []),
    infoRow('Proposed', `${d.ctx.date(d.makeup.date)} at ${d.makeup.time}`),
])}
${button('Review makeup classes', `${d.ctx.appUrl}/schedule/makeup`, d.ctx.primaryColor)}`,
    },

    makeupApproved: {
        subject: () => 'Makeup class confirmed',
        preheader: (d) => `${d.ctx.date(d.makeup.date)} at ${d.makeup.time}.`,
        html: (d) => h`
${callout('A makeup class has been confirmed.', 'success')}
${panel([
    infoRow('When', `${d.ctx.date(d.makeup.date)} at ${d.makeup.time}`),
    ...(d.student ? [infoRow('Student', d.ctx.name(d.student))] : []),
    ...(d.teacher ? [infoRow('Teacher', d.ctx.name(d.teacher))] : []),
])}
${button('View your schedule', `${d.ctx.appUrl}/schedule`, d.ctx.primaryColor)}`,
    },

    makeupRejected: {
        subject: () => 'Makeup class not approved',
        preheader: (d) => `Your request for ${d.ctx.date(d.makeup.date)} was declined.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.teacher)},`)}
${p(h`Your makeup class request for ${d.ctx.date(d.makeup.date)} at ${d.makeup.time} was not approved.`)}
${d.makeup.adminReason ? panel([infoRow('Reason', d.makeup.adminReason)]) : ''}
${muted('You can propose a different time from your schedule.')}`,
    },

    teacherOnLeave: {
        subject: (d) => `${d.ctx.name(d.teacher)} is on leave`,
        preheader: (d) => `${d.ctx.date(d.leave.startDate)}${d.leave.endDate ? ` to ${d.ctx.date(d.leave.endDate)}` : ''}.`,
        html: (d) => h`
${p(h`<strong>${d.ctx.name(d.teacher)}</strong> is on leave from ${d.ctx.date(d.leave.startDate)}${d.leave.endDate ? h` to ${d.ctx.date(d.leave.endDate)}` : ''}.`)}
${d.affectedSessions
    ? panel([infoRow('Affected classes', `${d.affectedSessions} ${d.ctx.plural(d.affectedSessions, 'session', 'sessions')}`)])
    : ''}
${p('We will confirm cover or rescheduling for any affected classes.')}
${button('View your schedule', `${d.ctx.appUrl}/schedule`, d.ctx.primaryColor)}`,
    },

    studentOnLeave: {
        subject: (d) => `Leave noted for ${d.ctx.name(d.student)}`,
        preheader: (d) => `${d.ctx.date(d.leave.startDate)}${d.leave.endDate ? ` to ${d.ctx.date(d.leave.endDate)}` : ''}.`,
        html: (d) => h`
${p(h`We have recorded leave for <strong>${d.ctx.name(d.student)}</strong> from ${d.ctx.date(d.leave.startDate)}${d.leave.endDate ? h` to ${d.ctx.date(d.leave.endDate)}` : ''}.`)}
${d.affectedSessions
    ? panel([infoRow('Classes in this period', `${d.affectedSessions} ${d.ctx.plural(d.affectedSessions, 'session', 'sessions')}`)])
    : ''}
${muted('Affected classes may be rescheduled — we will confirm separately.')}`,
    },

    sessionAutoEnded: {
        subject: (d) => `Session auto-ended: ${d.session.title}`,
        preheader: () => 'Everyone left without closing the session.',
        html: (d) => h`
${p(h`<strong>${d.session.title}</strong> was ended automatically because all participants left without closing it.`)}
${panel(sessionRows(d.session, d.ctx, d.teacher))}
${muted('Attendance and duration for this session may need checking.')}`,
    },
};
