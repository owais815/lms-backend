'use strict';

/**
 * announcementNotifier.js
 *
 * Pushes announcements to the notification bell once their scheduledTime arrives.
 *
 * This has to be a cron rather than a notify() call inside createAnnouncement:
 * that endpoint rejects a scheduledTime in the past, so every announcement is
 * future-dated by construction and notifying at creation would always fire early.
 *
 * The announcement itself stays in the Announcements table and on its own page —
 * this only delivers the "you have one" signal.
 *
 * Dedup is Announcements.notifiedAt, claimed before sending. Rows that predate
 * the column are backfilled to NOW() by patchEnumColumns() in app.js; without
 * that backfill the first run after deploy would treat the entire history as
 * unsent and flood every user.
 */

const cron = require('node-cron');
const { Op } = require('sequelize');
const Announcements = require('../models/Announcements');
const notifyBulk = require('../utils/notifyBulk');

const PKT = 'Asia/Karachi';
const BATCH_LIMIT = 500;

// Announcements.type has no severity built in; payment is the one that costs
// someone money if ignored.
const priorityFor = (type) => (type === 'payment' ? 'warning' : 'info');

async function run() {
  try {
    const due = await Announcements.findAll({
      where: {
        notifiedAt: null,
        scheduledTime: { [Op.lte]: new Date() },
      },
      order: [['scheduledTime', 'ASC']],
      limit: BATCH_LIMIT,
    });
    if (due.length === 0) return 0;

    // Claim first, deliver second.
    await Announcements.update(
      { notifiedAt: new Date() },
      { where: { id: due.map((a) => a.id) } }
    );

    // Each row already targets exactly one recipient, so this is a straight map.
    await notifyBulk(
      due.map((a) => ({
        userId: a.userId,
        userType: a.userType,
        // Title must contain "Announcement" so the bell picks the right icon.
        title: `Announcement: ${a.title}`,
        message: a.message,
        priority: priorityFor(a.type),
      }))
    );

    console.log(`[announcementNotifier] Delivered ${due.length} announcement(s).`);
    return due.length;
  } catch (error) {
    console.error('[announcementNotifier] Error during delivery run:', error);
    return 0;
  }
}

function startAnnouncementNotifierCron() {
  cron.schedule('*/5 * * * *', run, { timezone: PKT });
  console.log('[announcementNotifier] Announcement notifier cron started (runs every 5 minutes).');
}

module.exports = { startAnnouncementNotifierCron, run };
