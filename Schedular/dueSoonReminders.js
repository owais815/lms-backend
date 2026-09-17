'use strict';

/**
 * dueSoonReminders.js
 *
 * Runs daily at 09:00 PKT — clear of the 00:05 / 00:10 / 00:15 fee and salary
 * crons, and at an hour when a reminder is actually useful.
 *
 * Covers two things:
 *   - assignments due within 48 hours, to students who have not finished
 *   - fees due within 3 days
 *
 * Dedup is a column on each row (dueReminderSentAt), claimed before sending, and
 * nulled again by the update handlers when the due date moves.
 *
 * Quizzes are not covered: the Quiz model has no date column of any kind, so
 * there is nothing to remind against.
 */

const cron = require('node-cron');
const { Op } = require('sequelize');
const Assignment = require('../models/Assignment/Assignment');
const SubmittedAssignment = require('../models/Assignment/SubmittedAssignment');
const Fee = require('../models/Fee');
const Student = require('../models/Student');
const { notifyStudentsAndParents } = require('../utils/notifyAudience');

const PKT = 'Asia/Karachi';
const ASSIGNMENT_LEAD_HOURS = 48;
const FEE_LEAD_DAYS = 3;

async function remindAssignments() {
  const now = new Date();
  const until = new Date(now.getTime() + ASSIGNMENT_LEAD_HOURS * 3600 * 1000);

  const due = await Assignment.findAll({
    where: {
      status: 'active',
      dueReminderSentAt: null,
      dueDate: { [Op.between]: [now, until] },
    },
  });
  if (due.length === 0) return 0;

  // Claim first — a slow run should cost a reminder, never duplicate one.
  await Assignment.update(
    { dueReminderSentAt: new Date() },
    { where: { id: due.map((a) => a.id) } }
  );

  let sent = 0;
  for (const assignment of due) {
    // Only nag students who still owe work. Reminding someone who already
    // submitted is the spam case that makes people stop reading the bell.
    const outstanding = await SubmittedAssignment.findAll({
      where: {
        assignmentId: assignment.id,
        status: { [Op.notIn]: ['Submitted', 'Graded'] },
      },
      attributes: ['studentId'],
    });
    if (outstanding.length === 0) continue;

    const when = new Date(assignment.dueDate).toISOString().split('T')[0];
    await notifyStudentsAndParents({
      studentIds: outstanding.map((r) => r.studentId),
      title: 'Assignment Due Soon',
      message: `Your assignment "${assignment.title}" is due ${when} and has not been submitted yet.`,
      parentMessage: `Your child's assignment "${assignment.title}" is due ${when} and has not been submitted yet.`,
      priority: 'warning',
    });
    sent += outstanding.length;
  }
  return sent;
}

async function remindFees() {
  const today = new Date().toISOString().split('T')[0];
  const until = new Date(Date.now() + FEE_LEAD_DAYS * 86400 * 1000)
    .toISOString()
    .split('T')[0];

  const due = await Fee.findAll({
    where: {
      status: 'pending',
      dueReminderSentAt: null,
      dueDate: { [Op.between]: [today, until] },
    },
    include: [{ model: Student, attributes: ['id', 'firstName', 'lastName', 'parentId'] }],
  });
  if (due.length === 0) return 0;

  await Fee.update(
    { dueReminderSentAt: new Date() },
    { where: { id: due.map((f) => f.id) } }
  );

  let sent = 0;
  for (const fee of due) {
    if (!fee.Student) continue;
    await notifyStudentsAndParents({
      students: [fee.Student],
      title: 'Fee Due Soon',
      message: `Your fee "${fee.title}" of ${fee.amount} is due ${fee.dueDate}.`,
      parentMessage: `The fee "${fee.title}" of ${fee.amount} is due ${fee.dueDate}.`,
    });
    sent += 1;
  }
  return sent;
}

async function run() {
  try {
    const assignments = await remindAssignments();
    const fees = await remindFees();
    if (assignments || fees) {
      console.log(
        `[dueSoonReminders] Reminded ${assignments} assignment recipient(s), ${fees} fee(s).`
      );
    }
    return { assignments, fees };
  } catch (error) {
    console.error('[dueSoonReminders] Error during reminder run:', error);
    return { assignments: 0, fees: 0 };
  }
}

function startDueSoonRemindersCron() {
  cron.schedule('0 9 * * *', run, { timezone: PKT });
  console.log('[dueSoonReminders] Due-soon reminders cron started (runs daily at 09:00 PKT).');
}

module.exports = { startDueSoonRemindersCron, run };
