'use strict';

const { defineEvent } = require('./schema');

/**
 * Teacher payroll and expenses. This whole category had zero notifications of
 * any kind before — teachers had no way to learn a salary was raised or paid
 * except by opening the dashboard.
 *
 * Anchor sites: controllers/salary.js, expense.js,
 * Schedular/markOverdueSalaries.js
 */

const sampleSalary = {
    id: 5,
    amount: '60000.00',
    month: '2026-03',
    dueDate: '2026-03-31',
    paidDate: null,
    status: 'unpaid',
};
const sampleTeacher = { id: 3, firstName: 'Bilal', lastName: 'Ahmed' };

module.exports = [
    defineEvent({
        key: 'salary.generated',
        category: 'salary',
        label: 'Salary record created',
        description: 'Tells a teacher a salary record has been raised for the month.',
        defaultEnabled: true,
        audiences: ['teacher'],
        template: 'salary/generated',
        entityType: 'salary',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: { salary: sampleSalary, teacher: sampleTeacher },
    }),

    defineEvent({
        key: 'salary.paid',
        category: 'salary',
        label: 'Salary paid',
        description: 'Payslip confirmation sent when a salary is marked paid.',
        // Transactional: a payslip is a pay record, not an announcement.
        transactional: true,
        defaultEnabled: true,
        audiences: ['teacher'],
        template: 'salary/paid',
        entityType: 'salary',
        dedupScope: 'entity',
        priority: 2,
        samplePayload: {
            salary: { ...sampleSalary, status: 'paid', paidDate: '2026-03-30' },
            teacher: sampleTeacher,
        },
    }),

    defineEvent({
        key: 'salary.proof_uploaded',
        category: 'salary',
        label: 'Salary payment proof uploaded',
        description: 'Tells a teacher that proof of their salary transfer has been attached.',
        defaultEnabled: true,
        audiences: ['teacher'],
        template: 'salary/proofUploaded',
        entityType: 'salary',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: { salary: sampleSalary, teacher: sampleTeacher },
    }),

    defineEvent({
        key: 'salary.overdue_teacher',
        category: 'salary',
        label: 'Salary overdue (teacher)',
        description: 'Tells a teacher their salary has passed its due date and is being chased.',
        defaultEnabled: false,
        audiences: ['teacher'],
        template: 'salary/overdueTeacher',
        entityType: 'salary',
        dedupScope: 'entity+day',
        priority: 2,
        samplePayload: { salary: { ...sampleSalary, status: 'overdue' }, teacher: sampleTeacher },
    }),

    defineEvent({
        key: 'salary.overdue_admin',
        category: 'salary',
        label: 'Salaries gone overdue (admin)',
        description: 'Daily summary to admins of salary payments that have passed their due date.',
        defaultEnabled: true,
        audiences: ['admin'],
        template: 'salary/overdueAdmin',
        entityType: 'salary_batch',
        dedupScope: 'entity+day',
        priority: 2,
        samplePayload: { count: 3, salaries: [sampleSalary] },
    }),

    defineEvent({
        key: 'expense.submitted',
        category: 'salary',
        label: 'Expense submitted',
        description: 'Alerts admins that an expense has been logged and needs review.',
        defaultEnabled: false,
        audiences: ['admin'],
        template: 'salary/expenseSubmitted',
        entityType: 'expense',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            expense: { id: 21, title: 'Whiteboard markers', amount: '1200.00' },
        },
    }),

    defineEvent({
        key: 'expense.approved',
        category: 'salary',
        label: 'Expense approved',
        description: 'Tells the submitter their expense claim was approved.',
        defaultEnabled: false,
        audiences: ['teacher'],
        template: 'salary/expenseApproved',
        entityType: 'expense',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            expense: { id: 21, title: 'Whiteboard markers', amount: '1200.00' },
            teacher: sampleTeacher,
        },
    }),

    defineEvent({
        key: 'expense.rejected',
        category: 'salary',
        label: 'Expense rejected',
        description: 'Tells the submitter their expense claim was not approved.',
        defaultEnabled: false,
        audiences: ['teacher'],
        template: 'salary/expenseRejected',
        entityType: 'expense',
        dedupScope: 'entity',
        priority: 3,
        samplePayload: {
            expense: { id: 21, title: 'Whiteboard markers', amount: '1200.00', reason: 'Missing receipt' },
            teacher: sampleTeacher,
        },
    }),
];
