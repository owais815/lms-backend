'use strict';

/**
 * Reminder materializer.
 *
 * Scans forward every 15 minutes for entities entering a reminder window and
 * enqueues jobs for the near term only.
 *
 * Why not simply enqueue a job with a 7-day delay: a queued job is a snapshot.
 * A fee reminder enqueued a week out embeds an amount and a due date an admin
 * may edit tomorrow, and a class reminder enqueued 24h out survives the class
 * being cancelled. Re-deriving from live tables avoids both, and the dedup key
 * is what makes re-deriving every 15 minutes free rather than catastrophic.
 *
 * It also makes the two queue drivers behave identically for the hardest case,
 * so switching Redis on later cannot change reminder behaviour.
 */

const cron = require('node-cron');
const { Op } = require('sequelize');
const moment = require('moment-timezone');

const { sendEmailEvent, buckets } = require('../emails');
const settings = require('../emails/settings/cache');

const Fee = require('../models/Fee');
const Student = require('../models/Student');
const ClassSession = require('../models/ClassSession');
const Teacher = require('../models/Teacher');
const Assignment = require('../models/Assignment/Assignment');
const Salary = require('../models/Salary');

/** Effective per-event config, with the admin's overrides applied. */
function eventConfig(key, fallback) {
    const s = settings.forEvent(key);
    return (s && s.config) || fallback;
}

function isEnabled(key) {
    const s = settings.forEvent(key);
    return Boolean(s && s.enabled);
}

/**
 * Upcoming classes, one reminder per configured lead time.
 *
 * The dedup bucket includes the session's scheduled datetime, so rescheduling a
 * class produces a NEW bucket and the reminder correctly fires again for the new
 * time. A bucket keyed only on session id plus lead time would suppress it.
 */
async function runClassReminders(tz, windowMinutes) {
    if (!isEnabled('reminder.class_upcoming')) return 0;

    const leads = eventConfig('reminder.class_upcoming', { leadTimesMinutes: [1440, 60] }).leadTimesMinutes || [];
    let queued = 0;

    for (const leadMinutes of leads) {
        const target = moment().tz(tz).add(leadMinutes, 'minutes');
        const from = target.clone();
        const to = target.clone().add(windowMinutes, 'minutes');

        // Compare against the combined date+time, since ClassSession splits them
        // across a DATEONLY and a TIME column.
        const sessions = await ClassSession.findAll({
            where: {
                status: 'scheduled',
                date: { [Op.between]: [from.format('YYYY-MM-DD'), to.format('YYYY-MM-DD')] },
            },
            include: [
                { model: Student, attributes: ['id', 'parentId'], required: false },
                { model: Teacher, attributes: ['id'], required: false },
            ],
            limit: 500,
        });

        for (const session of sessions) {
            const startsAt = moment.tz(
                `${String(session.date).slice(0, 10)} ${session.startTime}`,
                'YYYY-MM-DD HH:mm:ss',
                tz
            );
            if (!startsAt.isBetween(from, to, undefined, '[)')) continue;

            const result = await sendEmailEvent(
                'reminder.class_upcoming',
                { session, student: session.Student, teacher: session.Teacher, leadMinutes },
                {
                    dedupBucket: buckets.scheduled(session.date, session.startTime, `${leadMinutes}m`),
                    occurredAt: new Date(),
                }
            );
            queued += result.queued;
        }
    }

    return queued;
}

/** Fees approaching their due date, one reminder per configured lead time. */
async function runFeeReminders(tz) {
    if (!isEnabled('reminder.fee_due')) return 0;

    const leads = eventConfig('reminder.fee_due', { leadTimesDays: [7, 3, 1] }).leadTimesDays || [];
    let queued = 0;

    for (const leadDays of leads) {
        const dueDate = moment().tz(tz).add(leadDays, 'days').format('YYYY-MM-DD');

        const fees = await Fee.findAll({
            where: { status: 'pending', dueDate },
            include: [{ model: Student, attributes: ['id', 'parentId', 'firstName', 'lastName'] }],
            limit: 500,
        });

        for (const fee of fees) {
            const result = await sendEmailEvent(
                'reminder.fee_due',
                { fee, student: fee.Student, leadDays },
                { dedupBucket: buckets.leadDays(leadDays), occurredAt: new Date() }
            );
            queued += result.queued;
        }
    }

    return queued;
}

/** Assignments due soon. */
async function runAssignmentReminders(tz) {
    if (!isEnabled('reminder.assignment_due')) return 0;

    const leads = eventConfig('reminder.assignment_due', { leadTimesDays: [1] }).leadTimesDays || [];
    let queued = 0;

    for (const leadDays of leads) {
        // Assignment.dueDate is a full DATETIME, not a DATEONLY like Fee.dueDate,
        // so this has to match the whole day rather than an exact timestamp.
        const day = moment().tz(tz).add(leadDays, 'days');
        const dayStart = day.clone().startOf('day').toDate();
        const dayEnd = day.clone().endOf('day').toDate();

        const assignments = await Assignment.findAll({
            where: {
                dueDate: { [Op.between]: [dayStart, dayEnd] },
                status: 'active', // enum is pending | active | rejected
            },
            limit: 500,
        });

        for (const assignment of assignments) {
            const result = await sendEmailEvent(
                'reminder.assignment_due',
                { assignment, courseId: assignment.courseId, teacherId: assignment.teacherId, leadDays },
                { dedupBucket: buckets.leadDays(leadDays), occurredAt: new Date() }
            );
            queued += result.queued;
        }
    }

    return queued;
}

/** Teacher salaries approaching their due date — an admin-facing reminder. */
async function runSalaryReminders(tz) {
    if (!isEnabled('reminder.salary_due')) return 0;

    const leads = eventConfig('reminder.salary_due', { leadTimesDays: [3] }).leadTimesDays || [];
    let queued = 0;

    for (const leadDays of leads) {
        const dueDate = moment().tz(tz).add(leadDays, 'days').format('YYYY-MM-DD');

        const salaries = await Salary.findAll({
            // enum is paid | unpaid | partial | overdue
            where: { status: { [Op.in]: ['unpaid', 'partial'] }, dueDate },
            include: [{ model: Teacher, attributes: ['id', 'firstName', 'lastName'] }],
            limit: 500,
        });

        for (const salary of salaries) {
            const result = await sendEmailEvent(
                'reminder.salary_due',
                { salary, teacher: salary.Teacher, leadDays },
                { dedupBucket: buckets.leadDays(leadDays), occurredAt: new Date() }
            );
            queued += result.queued;
        }
    }

    return queued;
}

async function runAll() {
    const tz = settings.get('global.timezone', 'Asia/Karachi');
    // The scan window matches the cron interval, so every minute in the future
    // is covered exactly once.
    const windowMinutes = 15;

    try {
        const results = await Promise.all([
            runClassReminders(tz, windowMinutes),
            runFeeReminders(tz),
            runAssignmentReminders(tz),
            runSalaryReminders(tz),
        ]);
        const total = results.reduce((a, b) => a + b, 0);
        if (total > 0) console.log(`[emailReminders] queued ${total} reminder email(s).`);
    } catch (err) {
        console.error('[emailReminders] run failed:', err.message);
    }
}

function startEmailRemindersCron() {
    cron.schedule('*/15 * * * *', runAll);
    console.log('[emailReminders] started (runs every 15 minutes).');
}

module.exports = { startEmailRemindersCron, runAll };
