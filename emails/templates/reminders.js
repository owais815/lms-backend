'use strict';

/**
 * Reminder templates.
 *
 * Each one is rendered once per configured lead time, so the copy has to make
 * the lead time obvious — "in 3 days" reads very differently from "tomorrow"
 * and a reminder that does not say which is nearly useless.
 */

const { h } = require('./escape');
const { p, panel, infoRow, button, muted, callout } = require('./components');

/** "tomorrow" / "in 3 days" — reminders must state their own horizon. */
const inDays = (n) => (Number(n) === 1 ? 'tomorrow' : `in ${n} days`);

const inMinutes = (mins) => {
    const m = Number(mins);
    if (m >= 1440) {
        const days = Math.round(m / 1440);
        return days === 1 ? 'tomorrow' : `in ${days} days`;
    }
    if (m >= 60) {
        const hours = Math.round(m / 60);
        return hours === 1 ? 'in an hour' : `in ${hours} hours`;
    }
    return `in ${m} minutes`;
};

module.exports = {
    classUpcoming: {
        subject: (d) => `${d.session.title} starts ${inMinutes(d.leadMinutes)}`,
        preheader: (d) => d.ctx.dateAndTime(d.session.date, d.session.startTime),
        html: (d) => h`
${p(h`<strong>${d.session.title}</strong> starts ${inMinutes(d.leadMinutes)}.`)}
${panel([
    infoRow('Class', d.session.title),
    infoRow('Starts', d.ctx.dateAndTime(d.session.date, d.session.startTime)),
    ...(d.teacher ? [infoRow('Teacher', d.ctx.name(d.teacher))] : []),
])}
${d.session.meetingLink
    ? button('Join the class', d.session.meetingLink, d.ctx.primaryColor)
    : button('View your schedule', `${d.ctx.appUrl}/schedule`, d.ctx.primaryColor)}`,
    },

    feeDue: {
        subject: (d) => `${d.fee.title} is due ${inDays(d.leadDays)}`,
        preheader: (d) => `${d.ctx.money(d.fee.amount)} due on ${d.ctx.date(d.fee.dueDate)}.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${p(h`<strong>${d.fee.title}</strong> is due ${inDays(d.leadDays)}.`)}
${panel([
    infoRow('Item', d.fee.title),
    infoRow('Amount', d.ctx.money(d.fee.amount)),
    infoRow('Due date', d.ctx.date(d.fee.dueDate)),
])}
${button('View your fees', `${d.ctx.appUrl}/student/fees`, d.ctx.primaryColor)}
${muted('If you have already paid, please ignore this — it may have crossed with your payment.')}`,
    },

    assignmentDue: {
        subject: (d) => `${d.assignment.title} is due ${inDays(d.leadDays)}`,
        preheader: (d) => `Due ${d.ctx.date(d.assignment.dueDate)}.`,
        html: (d) => h`
${p(h`<strong>${d.assignment.title}</strong> is due ${inDays(d.leadDays)}.`)}
${panel([
    infoRow('Assignment', d.assignment.title),
    infoRow('Due', d.ctx.date(d.assignment.dueDate)),
])}
${button('Open assignment', `${d.ctx.appUrl}/student/assignments`, d.ctx.primaryColor)}`,
    },

    salaryDue: {
        subject: (d) => `Salary due ${inDays(d.leadDays)} — ${d.ctx.name(d.teacher)}`,
        preheader: (d) => `${d.ctx.money(d.salary.amount)} due ${d.ctx.date(d.salary.dueDate)}.`,
        html: (d) => h`
${p(h`A teacher salary payment is due ${inDays(d.leadDays)}.`)}
${panel([
    infoRow('Teacher', d.ctx.name(d.teacher)),
    infoRow('Month', d.salary.month),
    infoRow('Amount', d.ctx.money(d.salary.amount)),
    infoRow('Due date', d.ctx.date(d.salary.dueDate)),
])}
${button('Open salaries', `${d.ctx.appUrl}/finance/salary`, d.ctx.primaryColor)}`,
    },

    missingLesson: {
        subject: (d) => `Week ${d.weekNumber} content still needed`,
        preheader: (d) => d.course ? `${d.course.courseName}, week ${d.weekNumber}.` : 'Lesson content is outstanding.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.teacher)},`)}
${callout(h`Content for <strong>Week ${String(d.weekNumber)}</strong>${d.course ? h` of ${d.course.courseName}` : ''} has not been uploaded yet.`, 'warning')}
${button('Upload content', `${d.ctx.appUrl}/teacher/content`, d.ctx.primaryColor)}`,
    },

    sessionFeedbackPending: {
        subject: (d) => `How was ${d.session.title}?`,
        preheader: () => 'Your feedback takes less than a minute.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.student)},`)}
${p(h`You attended <strong>${d.session.title}</strong> on ${d.ctx.date(d.session.date)}. How did it go?`)}
${button('Rate this class', `${d.ctx.appUrl}/student/feedback`, d.ctx.primaryColor)}
${muted('Your rating is shared with the admin team, not with your teacher directly.')}`,
    },
};
