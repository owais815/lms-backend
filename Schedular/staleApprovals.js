'use strict';

/**
 * staleApprovals.js
 *
 * Runs every hour. Notifies admins if assignments or quizzes have been
 * in 'pending' / 'pending_approval' status for more than 24 hours.
 * Sends one reminder per item (deduped in-memory per process run).
 */

const cron = require('node-cron');
const { Op } = require('sequelize');
const { Assignment, Quiz } = require('../models/association');
const notifyAdmins = require('../utils/notifyAdmins');

const alerted = new Set(); // 'assignment-{id}' | 'quiz-{id}'

const STALE_HOURS = 24;

async function checkStaleApprovals() {
  try {
    const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);

    // Stale assignments
    const staleAssignments = await Assignment.findAll({
      where: {
        status: 'pending_approval',
        createdAt: { [Op.lte]: cutoff },
      },
      attributes: ['id', 'title', 'createdAt'],
    });

    for (const a of staleAssignments) {
      const key = `assignment-${a.id}`;
      if (alerted.has(key)) continue;
      alerted.add(key);
      const hours = Math.floor((Date.now() - new Date(a.createdAt).getTime()) / 3600000);
      await notifyAdmins({
        title: 'Stale Assignment Approval',
        message: `Assignment "${a.title}" has been waiting for approval for ${hours} hours. Please review.`,
        priority: 'warning',
      });
    }

    // Stale quizzes — Quiz uses status 'pending_approval' or 'pending'
    const staleQuizzes = await Quiz.findAll({
      where: {
        status: { [Op.in]: ['pending_approval', 'pending'] },
        createdAt: { [Op.lte]: cutoff },
      },
      attributes: ['id', 'title', 'createdAt'],
    });

    const seenQuizIds = new Set();
    for (const q of staleQuizzes) {
      // Quiz can have duplicates per student — use title+date as unique key
      const key = `quiz-${q.id}`;
      if (alerted.has(key) || seenQuizIds.has(q.title)) continue;
      alerted.add(key);
      seenQuizIds.add(q.title);
      const hours = Math.floor((Date.now() - new Date(q.createdAt).getTime()) / 3600000);
      await notifyAdmins({
        title: 'Stale Quiz Approval',
        message: `Quiz "${q.title}" has been waiting for approval for ${hours} hours. Please review.`,
        priority: 'warning',
      });
    }
  } catch (err) {
    console.error('[staleApprovals] Error:', err.message);
  }
}

function startStaleApprovalsCron() {
  cron.schedule('0 * * * *', checkStaleApprovals); // every hour
  console.log('[staleApprovals] Cron started — checking every hour.');
}

module.exports = { startStaleApprovalsCron };
