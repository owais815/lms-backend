'use strict';

/**
 * classReminders.js
 *
 * Runs every 5 minutes. Finds scheduled sessions starting within the next 30
 * minutes and reminds the students and the teacher once.
 *
 * Dedup is a column (ClassSessions.reminderSentAt), not an in-memory Set, so a
 * restart cannot re-send and two app instances cannot double-send. The claim is
 * written BEFORE the notification goes out: the cron runs every 5 minutes over a
 * 30-minute window, so runs necessarily overlap, and a slow run should cost a
 * missed reminder rather than a duplicate one.
 *
 * Parents are deliberately excluded. A class starting in 30 minutes is not
 * something a parent can act on, and at 3 sessions/week it would be ~150
 * low-value notifications per child per year.
 */

const cron = require('node-cron');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const ClassSession = require('../models/ClassSession');
const ClassSchedule = require('../models/ClassSchedule');
const Teacher = require('../models/Teacher');
const { notifySessionAudience, displayName } = require('../utils/notifyAudience');

const PKT = 'Asia/Karachi';
const LEAD_MINUTES = 30;

async function run() {
  try {
    const now = moment.tz(PKT);
    const target = now.clone().add(LEAD_MINUTES, 'minutes');

    // The window can straddle midnight, so match on either date and tighten in JS.
    const candidates = await ClassSession.findAll({
      where: {
        reminderSentAt: null,
        status: 'scheduled',
        sessionStatus: 'idle',
        date: { [Op.in]: [now.format('YYYY-MM-DD'), target.format('YYYY-MM-DD')] },
      },
      include: [
        { model: ClassSchedule, as: 'schedule', attributes: ['id', 'status'], required: false },
        { model: Teacher, attributes: ['id', 'firstName', 'lastName'], required: false },
      ],
    });

    const due = candidates.filter((session) => {
      // A schedule can be cancelled without every session row flipping.
      if (session.schedule && session.schedule.status === 'cancelled') return false;
      const startsAt = moment.tz(
        `${session.date} ${session.startTime}`,
        'YYYY-MM-DD HH:mm:ss',
        PKT
      );
      if (!startsAt.isValid()) return false;
      return startsAt.isAfter(now) && startsAt.isSameOrBefore(target);
    });

    if (due.length === 0) return 0;

    // Claim first, notify second.
    await ClassSession.update(
      { reminderSentAt: new Date() },
      { where: { id: due.map((s) => s.id) } }
    );

    for (const session of due) {
      const startsAt = moment.tz(
        `${session.date} ${session.startTime}`,
        'YYYY-MM-DD HH:mm:ss',
        PKT
      );
      const at = startsAt.format('HH:mm');
      const teacherName = displayName(session.Teacher, 'your teacher');

      await notifySessionAudience({
        session,
        title: 'Class Starting Soon',
        message: `"${session.title}" with ${teacherName} starts at ${at}.`,
        teacherMessage: `Your class "${session.title}" starts at ${at}.`,
        includeTeacher: true,
        includeParents: false,
      });
    }

    console.log(`[classReminders] Sent reminders for ${due.length} session(s).`);
    return due.length;
  } catch (error) {
    console.error('[classReminders] Error during reminder run:', error);
    return 0;
  }
}

function startClassRemindersCron() {
  cron.schedule('*/5 * * * *', run, { timezone: PKT });
  console.log('[classReminders] Class reminders cron started (runs every 5 minutes).');
}

module.exports = { startClassRemindersCron, run };
