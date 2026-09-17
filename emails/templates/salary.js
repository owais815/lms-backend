'use strict';

/**
 * Payroll and expense templates.
 *
 * Teachers had no notification of any kind for this category before, so these
 * carry more context than their in-app equivalents would need.
 */

const { h } = require('./escape');
const { p, panel, infoRow, button, callout, muted, table } = require('./components');

const salaryRows = (salary, ctx) => [
    infoRow('Month', salary.month),
    infoRow('Amount', ctx.money(salary.amount)),
    infoRow('Due date', ctx.date(salary.dueDate)),
];

const salaryButton = (ctx) => button('View your salary records', `${ctx.appUrl}/teacher/salary`, ctx.primaryColor);

module.exports = {
    generated: {
        subject: (d) => `Salary record for ${d.salary.month}`,
        preheader: (d) => `${d.ctx.money(d.salary.amount)} due ${d.ctx.date(d.salary.dueDate)}.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.teacher)},`)}
${p(h`A salary record has been created for <strong>${d.salary.month}</strong>.`)}
${panel(salaryRows(d.salary, d.ctx))}
${salaryButton(d.ctx)}`,
    },

    paid: {
        subject: (d) => `Salary paid — ${d.salary.month}`,
        preheader: (d) => `${d.ctx.money(d.salary.amount)} paid on ${d.ctx.date(d.salary.paidDate)}.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.teacher)},`)}
${callout(h`Your salary for <strong>${d.salary.month}</strong> has been paid.`, 'success')}
${panel([
    infoRow('Month', d.salary.month),
    infoRow('Amount', d.ctx.money(d.salary.amount)),
    infoRow('Paid on', d.ctx.date(d.salary.paidDate)),
])}
${salaryButton(d.ctx)}
${muted('Please keep this email for your records.')}`,
        text: (d) => [
            `Hi ${d.ctx.name(d.teacher)},`,
            '',
            `Your salary for ${d.salary.month} has been paid.`,
            '',
            `Month:   ${d.salary.month}`,
            `Amount:  ${d.ctx.money(d.salary.amount)}`,
            `Paid on: ${d.ctx.date(d.salary.paidDate)}`,
            '',
            'Please keep this email for your records.',
        ].join('\n'),
    },

    proofUploaded: {
        subject: (d) => `Payment proof attached — ${d.salary.month}`,
        preheader: () => 'Proof of your salary transfer is now on file.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.teacher)},`)}
${p(h`Proof of payment for your <strong>${d.salary.month}</strong> salary has been uploaded to your record.`)}
${panel(salaryRows(d.salary, d.ctx))}
${salaryButton(d.ctx)}`,
    },

    overdueTeacher: {
        subject: (d) => `Your ${d.salary.month} salary is overdue`,
        preheader: (d) => `${d.ctx.money(d.salary.amount)} was due ${d.ctx.date(d.salary.dueDate)}.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.teacher)},`)}
${callout(h`Your salary for <strong>${d.salary.month}</strong> has passed its due date and is being followed up.`, 'warning')}
${panel(salaryRows(d.salary, d.ctx))}
${muted('You do not need to do anything — this is a courtesy notice so you know we are aware.')}`,
    },

    overdueAdmin: {
        subject: (d) => `${d.count} salary payment${d.count === 1 ? '' : 's'} overdue`,
        preheader: (d) => `${d.count} teacher salar${d.count === 1 ? 'y has' : 'ies have'} passed their due date.`,
        html: (d) => h`
${p(h`<strong>${String(d.count)}</strong> teacher salary payment${d.count === 1 ? ' has' : 's have'} passed their due date.`)}
${d.salaries && d.salaries.length
    ? table(
        ['Teacher', 'Month', 'Amount', 'Due'],
        d.salaries.slice(0, 25).map((s) => [
            s.teacherName || `#${s.teacherId}`,
            s.month,
            d.ctx.money(s.amount),
            d.ctx.date(s.dueDate),
        ])
      )
    : ''}
${button('Review salaries', `${d.ctx.appUrl}/finance/salary`, d.ctx.primaryColor)}`,
    },

    expenseSubmitted: {
        subject: (d) => `Expense submitted — ${d.expense.title}`,
        preheader: (d) => `${d.ctx.money(d.expense.amount)} awaiting review.`,
        html: (d) => h`
${p('A new expense has been logged and needs review.')}
${panel([
    infoRow('Item', d.expense.title),
    infoRow('Amount', d.ctx.money(d.expense.amount)),
])}
${button('Review expenses', `${d.ctx.appUrl}/finance/expenses`, d.ctx.primaryColor)}`,
    },

    expenseApproved: {
        subject: (d) => `Expense approved — ${d.expense.title}`,
        preheader: (d) => `${d.ctx.money(d.expense.amount)} approved.`,
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.teacher)},`)}
${callout(h`Your expense claim for <strong>${d.expense.title}</strong> has been approved.`, 'success')}
${panel([
    infoRow('Item', d.expense.title),
    infoRow('Amount', d.ctx.money(d.expense.amount)),
])}`,
    },

    expenseRejected: {
        subject: (d) => `Expense not approved — ${d.expense.title}`,
        preheader: () => 'Your expense claim needs another look.',
        html: (d) => h`
${p(h`Hi ${d.ctx.name(d.teacher)},`)}
${p(h`Your expense claim for <strong>${d.expense.title}</strong> was not approved.`)}
${d.expense.reason ? panel([infoRow('Reason', d.expense.reason)]) : ''}
${muted('If you think this is a mistake, reply to this email and we will take another look.')}`,
    },
};
