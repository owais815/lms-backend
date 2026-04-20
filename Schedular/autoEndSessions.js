'use strict';

/**
 * autoEndSessions.js
 *
 * Cron job that runs every 2 minutes and auto-ends any ClassSession that is
 * still marked as "live" but whose calling-app room has no participants left.
 *
 * This handles the case where a teacher (and all students) simply close their
 * browser tab without clicking "End Session".
 *
 * Grace period: only auto-ends sessions that have been live for >5 minutes,
 * preventing false positives in the brief window between the teacher clicking
 * "Start Session" and actually joining the calling-app room.
 */

const cron = require('node-cron');
const { Op } = require('sequelize');
const ClassSession = require('../models/ClassSession');
const callingAppService = require('../services/callingAppService');
const socket = require('../socket');
const notify = require('../utils/notify');
const notifyAdmins = require('../utils/notifyAdmins');
const CourseDetails = require('../models/CourseDetails');

const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes

async function autoEndEmptySessions() {
  try {
    // 1. Find sessions that are live AND started more than 5 minutes ago.
    //    Sessions started <5 min ago are excluded to avoid the race condition
    //    between startSession (DB → live) and the teacher actually joining.
    const graceCutoff = new Date(Date.now() - GRACE_PERIOD_MS);

    const liveSessions = await ClassSession.findAll({
      where: {
        sessionStatus: 'live',
        liveStartedAt: { [Op.lte]: graceCutoff },
      },
      attributes: ['id', 'roomId', 'title', 'courseId', 'teacherId', 'studentId'],
    });

    if (liveSessions.length === 0) return;

    // 2. Fetch active meetings from the calling-app.
    //    Response shape: { meetings: [{ roomId: 'lms-42', peers: [{...}] }] }
    let meetings = [];
    try {
      const result = await callingAppService.getActiveMeetings();
      // Unwrap the { meetings: [...] } envelope
      meetings = Array.isArray(result) ? result : (result.meetings || []);
    } catch (err) {
      // Calling-app unreachable — skip this run rather than force-ending all sessions
      console.warn('[autoEndSessions] Could not reach calling-app:', err.message);
      return;
    }

    // Build a map: roomId → peer count (peers is an array of peer objects)
    const peerCountByRoom = {};
    for (const meeting of meetings) {
      const roomId = meeting.roomId;
      if (roomId) {
        peerCountByRoom[roomId] = Array.isArray(meeting.peers) ? meeting.peers.length : 0;
      }
    }

    // 3. Check each eligible live session
    for (const session of liveSessions) {
      if (!session.roomId) continue;

      const peerCount = peerCountByRoom[session.roomId];

      // Room is empty if it has 0 peers OR doesn't appear in the meetings list
      // (MiroTalk removes a room from roomList once all peers leave)
      const roomEmpty = peerCount === undefined || peerCount === 0;

      if (!roomEmpty) continue;

      // 4. Auto-end the session
      console.log(
        `[autoEndSessions] Session ${session.id} (room ${session.roomId}) ` +
        `has been live >5 min with 0 peers — auto-ending.`
      );

      await session.update({ sessionStatus: 'ended', status: 'completed' });

      // Emit socket event so connected clients update their UI immediately
      try {
        const ioPromise = socket.getIO();
        if (ioPromise) {
          const io = await ioPromise;
          io.to(`session-${session.id}`).emit('session:ended', {
            sessionId: Number(session.id),
            title: session.title,
            autoEnded: true,
          });
        }
      } catch (socketErr) {
        console.warn('[autoEndSessions] Socket emit error (non-fatal):', socketErr.message);
      }

      // Notify admins that a session was auto-ended (non-fatal)
      notifyAdmins({
        title: 'Session Auto-Ended',
        message: `Session "${session.title}" was automatically ended — all participants left without closing the session.`,
        priority: 'warning',
      }).catch(() => {});

      // Notify enrolled students (non-fatal)
      try {
        if (session.courseId && session.teacherId) {
          const enrolled = await CourseDetails.findAll({
            where: { courseId: session.courseId, teacherId: session.teacherId },
            attributes: ['studentId'],
          });
          await Promise.all(
            enrolled.map((cd) =>
              notify({
                userId: cd.studentId,
                userType: 'student',
                title: 'Class Ended',
                message: `The class "${session.title}" has ended.`,
              })
            )
          );
        }
      } catch (notifErr) {
        console.warn('[autoEndSessions] Notification error (non-fatal):', notifErr.message);
      }
    }
  } catch (err) {
    console.error('[autoEndSessions] Unexpected error:', err.message);
  }
}

function startAutoEndSessionsCron() {
  cron.schedule('*/2 * * * *', autoEndEmptySessions);
  console.log('[autoEndSessions] Cron started — checking every 2 minutes.');
}

module.exports = { startAutoEndSessionsCron };
