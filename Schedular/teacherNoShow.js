'use strict';

/**
 * teacherNoShow.js
 *
 * Runs every 5 minutes. Checks for ClassSessions that are:
 *   - Scheduled for today
 *   - Expected start time was >15 minutes ago
 *   - Still in 'idle' status (teacher never clicked Start Session)
 *
 * Notifies all admins once per session (uses a Set to avoid duplicate alerts).
 */

const cron = require('node-cron');
const { Op } = require('sequelize');
const ClassSession = require('../models/ClassSession');
const Teacher = require('../models/Teacher');
const notifyAdmins = require('../utils/notifyAdmins');

const NO_SHOW_GRACE_MINUTES = 15;
const alertedSessions = new Set(); // in-memory dedup (resets on restart — acceptable)

async function checkTeacherNoShows() {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Grace cutoff: sessions whose start time was at least 15 min ago
    const graceCutoff = new Date(now.getTime() - NO_SHOW_GRACE_MINUTES * 60 * 1000);
    const graceCutoffTimeStr = graceCutoff.toTimeString().slice(0, 5); // "HH:MM"

    const overdueSessions = await ClassSession.findAll({
      where: {
        date: todayStr,
        sessionStatus: 'idle',
        status: { [Op.in]: ['scheduled', 'active'] },
        startTime: { [Op.lte]: graceCutoffTimeStr },
      },
      attributes: ['id', 'title', 'startTime', 'teacherId'],
    });

    for (const session of overdueSessions) {
      if (alertedSessions.has(session.id)) continue;
      alertedSessions.add(session.id);

      let teacherName = `Teacher #${session.teacherId}`;
      try {
        const teacher = await Teacher.findByPk(session.teacherId, { attributes: ['firstName', 'lastName'] });
        if (teacher) teacherName = `${teacher.firstName} ${teacher.lastName}`;
      } catch { /* non-fatal */ }

      await notifyAdmins({
        title: 'Teacher No-Show',
        message: `${teacherName} has not started the session "${session.title}" scheduled at ${session.startTime} (${NO_SHOW_GRACE_MINUTES}+ min overdue).`,
        priority: 'critical',
      });

      console.log(`[teacherNoShow] Alert sent for session ${session.id} — ${teacherName}`);
    }
  } catch (err) {
    console.error('[teacherNoShow] Error:', err.message);
  }
}

function startTeacherNoShowCron() {
  cron.schedule('*/5 * * * *', checkTeacherNoShows);
  console.log('[teacherNoShow] Cron started — checking every 5 minutes.');
}

module.exports = { startTeacherNoShowCron };
