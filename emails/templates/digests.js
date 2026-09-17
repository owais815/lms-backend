'use strict';

/**
 * Periodic digest templates.
 *
 * These are the only per-recipient templates: one email covering many entities,
 * so they loop rather than describing a single thing. A parent with two children
 * gets one report with two sections, not two reports.
 */

const { h, raw } = require('./escape');
const { p, panel, infoRow, button, table, heading, muted, divider, callout } = require('./components');

module.exports = {
    adminOpsDaily: {
        subject: (d) => `Daily summary — ${d.ctx.date(d.date)}`,
        preheader: (d) =>
            `${d.overdueFees.count} overdue fee${d.overdueFees.count === 1 ? '' : 's'}, ` +
            `${d.pendingApprovals.assignments + d.pendingApprovals.quizzes} awaiting approval.`,
        html: (d) => h`
${p(h`Here is where things stand as of ${d.ctx.date(d.date)}.`)}

${heading('Money')}
${panel([
    infoRow('Overdue fees', `${d.overdueFees.count} (${d.ctx.money(d.overdueFees.total)})`),
    infoRow('Overdue salaries', String(d.overdueSalaries.count)),
    infoRow('Failed payments', String(d.failedPayments || 0)),
])}

${heading('Teaching')}
${panel([
    infoRow('Teacher no-shows', String(d.noShows || 0)),
    infoRow('Missing lesson content', String(d.missingContent || 0)),
])}

${heading('Waiting on you')}
${panel([
    infoRow('Assignments to approve', String(d.pendingApprovals.assignments)),
    infoRow('Quizzes to approve', String(d.pendingApprovals.quizzes)),
])}

${button('Open dashboard', `${d.ctx.appUrl}/dashboard`, d.ctx.primaryColor)}
${muted('This summary is sent once a day. You can turn it off in Settings → Email notifications.')}`,
    },

    parentProgressWeekly: {
        subject: (d) => `Weekly progress report — ${d.weekLabel}`,
        preheader: (d) =>
            d.children.length === 1
                ? `How ${d.children[0].student.firstName} got on this week.`
                : `Progress for ${d.children.length} children this week.`,
        html: (d) => h`
${p(h`Here is how ${d.children.length === 1 ? d.children[0].student.firstName : 'your children'} got on during ${d.weekLabel}.`)}
${raw(d.children.map((child, i) => h`
${i > 0 ? divider() : ''}
${heading(d.ctx.name(child.student))}
${panel([
    infoRow('Attendance', `${child.attendance.present} present, ${child.attendance.absent} absent${child.attendance.late ? `, ${child.attendance.late} late` : ''}`),
    infoRow('Fees', child.fees.overdue
        ? `${d.ctx.money(child.fees.outstanding)} overdue`
        : (Number(child.fees.outstanding) > 0 ? `${d.ctx.money(child.fees.outstanding)} outstanding` : 'Up to date')),
])}
${child.grades && child.grades.length
    ? table(['Assessment', 'Score'], child.grades.map((g) => [g.title, String(g.score)]))
    : muted('No graded work this week.')}
${child.upcoming && child.upcoming.length
    ? h`${muted('Coming up:')}${table(
        ['Class', 'When'],
        child.upcoming.map((s) => [s.title, d.ctx.dateAndTime(s.date, s.startTime)])
      )}`
    : ''}`).join(''))}
${button('Open parent dashboard', `${d.ctx.appUrl}/parent/dashboard`, d.ctx.primaryColor)}`,
    },

    teacherScheduleWeekly: {
        subject: (d) => `Your week ahead — ${d.weekLabel}`,
        preheader: (d) => `${d.sessions.length} class${d.sessions.length === 1 ? '' : 'es'} scheduled.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.teacher)}, here is your week ahead.`)}
${d.sessions && d.sessions.length
    ? table(['Class', 'When'], d.sessions.map((s) => [s.title, d.ctx.dateAndTime(s.date, s.startTime)]))
    : muted('You have no classes scheduled this week.')}
${(d.pending && (d.pending.ungradedAssignments || (d.pending.contentWeeks || []).length))
    ? h`${heading('Waiting on you')}${panel([
        ...(d.pending.ungradedAssignments
            ? [infoRow('Assignments to grade', String(d.pending.ungradedAssignments))]
            : []),
        ...((d.pending.contentWeeks || []).length
            ? [infoRow('Content to upload', `Week ${d.pending.contentWeeks.join(', ')}`)]
            : []),
    ])}`
    : ''}
${button('Open your schedule', `${d.ctx.appUrl}/teacher/schedule`, d.ctx.primaryColor)}`,
    },

    revenueMonthly: {
        subject: (d) => `Revenue summary — ${d.monthLabel}`,
        preheader: (d) => `${d.ctx.money(d.collected)} collected, ${d.ctx.money(d.outstanding)} outstanding.`,
        html: (d) => h`
${p(h`Financial summary for <strong>${d.monthLabel}</strong>.`)}
${panel([
    infoRow('Collected', d.ctx.money(d.collected)),
    infoRow('Outstanding', d.ctx.money(d.outstanding)),
    infoRow('Overdue accounts', String(d.overdueCount)),
    infoRow('Salaries paid', d.ctx.money(d.salariesPaid)),
    infoRow('New students', String(d.newStudents)),
])}
${Number(d.overdueCount) > 0
    ? callout(h`${String(d.overdueCount)} account${d.overdueCount === 1 ? '' : 's'} still overdue at month end.`, 'warning')
    : ''}
${button('Open finance reports', `${d.ctx.appUrl}/finance/reports`, d.ctx.primaryColor)}`,
    },
};
