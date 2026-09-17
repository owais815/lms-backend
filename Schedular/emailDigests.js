'use strict';

/**
 * Digest builders: daily admin ops, weekly parent progress, weekly teacher
 * schedule, monthly revenue.
 *
 * These are the only per-recipient events — one email covering many entities
 * rather than one per entity — so each builder assembles a payload and hands it
 * to sendEmailEvent once per person, with __recipients set to bypass the normal
 * entity-driven resolution.
 *
 * The cron ticks hourly and each builder decides whether its configured send
 * hour has arrived. That keeps the send time admin-configurable without
 * re-registering cron expressions when a setting changes.
 */

const cron = require('node-cron');
const { Op, fn, col } = require('sequelize');
const moment = require('moment-timezone');

const { sendEmailEvent, buckets } = require('../emails');
const settings = require('../emails/settings/cache');
const resolvers = require('../emails/recipients/resolvers');

const Fee = require('../models/Fee');
const Salary = require('../models/Salary');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Teacher = require('../models/Teacher');
const ClassSession = require('../models/ClassSession');
const Assignment = require('../models/Assignment/Assignment');
const Quiz = require('../models/Quiz/Quiz');
const Attendance = require('../models/Attendance');

function eventConfig(key, fallback) {
    const s = settings.forEvent(key);
    return { ...fallback, ...((s && s.config) || {}) };
}

function isEnabled(key) {
    const s = settings.forEvent(key);
    return Boolean(s && s.enabled);
}

const money = (v) => Number(v || 0).toFixed(2);

// ---------------------------------------------------------------------------
// Daily admin operations digest
// ---------------------------------------------------------------------------
async function runAdminOpsDaily(now, tz) {
    const key = 'digest.admin_ops_daily';
    if (!isEnabled(key)) return 0;

    const cfg = eventConfig(key, { sendHour: 7 });
    if (now.hour() !== Number(cfg.sendHour)) return 0;

    const today = now.format('YYYY-MM-DD');

    const [overdueFees, overdueFeeTotal, overdueSalaries, pendingAssignments, pendingQuizzes] =
        await Promise.all([
            Fee.count({ where: { status: 'overdue' } }),
            Fee.sum('amount', { where: { status: 'overdue' } }),
            Salary.count({ where: { status: 'overdue' } }),
            Assignment.count({ where: { status: 'pending' } }),
            Quiz.count({ where: { status: 'pending' } }).catch(() => 0),
        ]);

    const noShows = await ClassSession.count({
        where: { date: today, status: 'scheduled', sessionStatus: 'idle' },
    }).catch(() => 0);

    const admins = await resolvers.resolveAdmins({}, settings.get('global.adminAlertEmails', []));
    if (admins.length === 0) return 0;

    const payload = {
        date: today,
        overdueFees: { count: overdueFees, total: money(overdueFeeTotal) },
        overdueSalaries: { count: overdueSalaries },
        noShows,
        pendingApprovals: { assignments: pendingAssignments, quizzes: pendingQuizzes },
        missingContent: 0,
        failedPayments: await Fee.count({ where: { proofStatus: 'rejected' } }).catch(() => 0),
    };

    let queued = 0;
    for (const admin of admins) {
        const r = await sendEmailEvent(key, { ...payload, __recipients: [admin] }, {
            dedupBucket: buckets.day(now),
            occurredAt: new Date(),
        });
        queued += r.queued;
    }
    return queued;
}

// ---------------------------------------------------------------------------
// Weekly parent progress report
// ---------------------------------------------------------------------------
async function runParentProgressWeekly(now, tz) {
    const key = 'digest.parent_progress_weekly';
    if (!isEnabled(key)) return 0;

    const cfg = eventConfig(key, { sendDay: 0, sendHour: 18 });
    if (now.day() !== Number(cfg.sendDay) || now.hour() !== Number(cfg.sendHour)) return 0;

    const weekStart = now.clone().subtract(7, 'days').startOf('day');
    const weekEnd = now.clone().endOf('day');
    const weekLabel = `${weekStart.format('D MMM')} – ${weekEnd.format('D MMM YYYY')}`;

    const parents = await Parent.findAll({
        where: { email: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } },
        attributes: ['id', 'firstName', 'lastName', 'email', 'timeZone'],
        limit: 2000,
    });

    let queued = 0;

    for (const parent of parents) {
        const students = await Student.findAll({
            where: { parentId: parent.id },
            attributes: ['id', 'firstName', 'lastName'],
        });
        if (students.length === 0) continue;

        const children = [];
        for (const student of students) {
            const [attendance, fees, upcoming] = await Promise.all([
                Attendance.findAll({
                    where: {
                        studentId: student.id,
                        date: { [Op.between]: [weekStart.format('YYYY-MM-DD'), weekEnd.format('YYYY-MM-DD')] },
                    },
                    attributes: ['status', [fn('COUNT', col('id')), 'n']],
                    group: ['status'],
                    raw: true,
                }).catch(() => []),
                Fee.findAll({
                    where: { studentId: student.id, status: { [Op.in]: ['pending', 'overdue'] } },
                    attributes: ['amount', 'status'],
                }),
                ClassSession.findAll({
                    where: {
                        studentId: student.id,
                        status: 'scheduled',
                        date: { [Op.between]: [now.format('YYYY-MM-DD'), now.clone().add(7, 'days').format('YYYY-MM-DD')] },
                    },
                    attributes: ['title', 'date', 'startTime'],
                    order: [['date', 'ASC'], ['startTime', 'ASC']],
                    limit: 10,
                }),
            ]);

            const counts = { present: 0, absent: 0, late: 0 };
            for (const row of attendance) {
                const status = String(row.status || '').toLowerCase();
                if (counts[status] !== undefined) counts[status] = Number(row.n);
            }

            children.push({
                student: student.get({ plain: true }),
                attendance: counts,
                grades: [],
                upcoming: upcoming.map((u) => u.get({ plain: true })),
                fees: {
                    outstanding: money(fees.reduce((sum, f) => sum + Number(f.amount || 0), 0)),
                    overdue: fees.some((f) => f.status === 'overdue'),
                },
            });
        }

        const recipient = {
            email: parent.email,
            name: [parent.firstName, parent.lastName].filter(Boolean).join(' '),
            role: 'parent',
            userId: parent.id,
            timeZone: parent.timeZone || null,
            source: 'db',
        };

        const r = await sendEmailEvent(
            key,
            { weekLabel, children, __recipients: [recipient] },
            { dedupBucket: buckets.week(now), occurredAt: new Date() }
        );
        queued += r.queued;
    }

    return queued;
}

// ---------------------------------------------------------------------------
// Weekly teacher schedule digest
// ---------------------------------------------------------------------------
async function runTeacherScheduleWeekly(now, tz) {
    const key = 'digest.teacher_schedule_weekly';
    if (!isEnabled(key)) return 0;

    const cfg = eventConfig(key, { sendDay: 0, sendHour: 18 });
    if (now.day() !== Number(cfg.sendDay) || now.hour() !== Number(cfg.sendHour)) return 0;

    const from = now.clone().startOf('day');
    const to = now.clone().add(7, 'days').endOf('day');
    const weekLabel = `${from.format('D MMM')} – ${to.format('D MMM YYYY')}`;

    const teachers = await Teacher.findAll({
        where: { email: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } },
        attributes: ['id', 'firstName', 'lastName', 'email', 'timeZone'],
        limit: 1000,
    });

    let queued = 0;

    for (const teacher of teachers) {
        const sessions = await ClassSession.findAll({
            where: {
                teacherId: teacher.id,
                status: 'scheduled',
                date: { [Op.between]: [from.format('YYYY-MM-DD'), to.format('YYYY-MM-DD')] },
            },
            attributes: ['title', 'date', 'startTime'],
            order: [['date', 'ASC'], ['startTime', 'ASC']],
            limit: 50,
        });

        // Nothing scheduled and nothing pending is not worth an email.
        if (sessions.length === 0) continue;

        const recipient = {
            email: teacher.email,
            name: [teacher.firstName, teacher.lastName].filter(Boolean).join(' '),
            role: 'teacher',
            userId: teacher.id,
            timeZone: teacher.timeZone || null,
            source: 'db',
        };

        const r = await sendEmailEvent(
            key,
            {
                weekLabel,
                teacher: teacher.get({ plain: true }),
                sessions: sessions.map((s) => s.get({ plain: true })),
                pending: { contentWeeks: [], ungradedAssignments: 0 },
                __recipients: [recipient],
            },
            { dedupBucket: buckets.week(now), occurredAt: new Date() }
        );
        queued += r.queued;
    }

    return queued;
}

// ---------------------------------------------------------------------------
// Monthly revenue summary
// ---------------------------------------------------------------------------
async function runRevenueMonthly(now, tz) {
    const key = 'digest.revenue_monthly';
    if (!isEnabled(key)) return 0;

    const cfg = eventConfig(key, { sendDayOfMonth: 1, sendHour: 8 });
    if (now.date() !== Number(cfg.sendDayOfMonth) || now.hour() !== Number(cfg.sendHour)) return 0;

    // Summarise the month that just ended, not the one a few hours old.
    const month = now.clone().subtract(1, 'month');
    const start = month.clone().startOf('month').format('YYYY-MM-DD');
    const end = month.clone().endOf('month').format('YYYY-MM-DD');

    const [collected, outstanding, overdueCount, salariesPaid, newStudents] = await Promise.all([
        Fee.sum('amount', { where: { status: 'paid', paidDate: { [Op.between]: [start, end] } } }),
        Fee.sum('amount', { where: { status: { [Op.in]: ['pending', 'overdue'] } } }),
        Fee.count({ where: { status: 'overdue' } }),
        Salary.sum('amount', { where: { status: 'paid', paidDate: { [Op.between]: [start, end] } } }),
        Student.count({ where: { createdAt: { [Op.between]: [`${start} 00:00:00`, `${end} 23:59:59`] } } }),
    ]);

    const admins = await resolvers.resolveAdmins({}, settings.get('global.adminAlertEmails', []));
    if (admins.length === 0) return 0;

    const payload = {
        monthLabel: month.format('MMMM YYYY'),
        collected: money(collected),
        outstanding: money(outstanding),
        overdueCount,
        salariesPaid: money(salariesPaid),
        newStudents,
    };

    let queued = 0;
    for (const admin of admins) {
        const r = await sendEmailEvent(key, { ...payload, __recipients: [admin] }, {
            dedupBucket: buckets.month(month),
            occurredAt: new Date(),
        });
        queued += r.queued;
    }
    return queued;
}

async function runAll() {
    const tz = settings.get('global.timezone', 'Asia/Karachi');
    const now = moment().tz(tz);

    try {
        const results = await Promise.all([
            runAdminOpsDaily(now, tz),
            runParentProgressWeekly(now, tz),
            runTeacherScheduleWeekly(now, tz),
            runRevenueMonthly(now, tz),
        ]);
        const total = results.reduce((a, b) => a + b, 0);
        if (total > 0) console.log(`[emailDigests] queued ${total} digest email(s).`);
    } catch (err) {
        console.error('[emailDigests] run failed:', err.message);
    }
}

function startEmailDigestsCron() {
    // Hourly on the hour: each builder checks its own configured send hour, so
    // changing the hour in the admin UI takes effect without touching cron.
    cron.schedule('0 * * * *', runAll);
    console.log('[emailDigests] started (runs hourly, each digest fires at its configured hour).');
}

module.exports = { startEmailDigestsCron, runAll };
