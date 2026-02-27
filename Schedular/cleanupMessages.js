const cron = require('node-cron');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const ChatMessage = require('../models/ChatMessage');
const Notification = require('../models/Notifications');

/**
 * Start the daily message cleanup scheduler.
 * @param {import('socket.io').Server} io - Socket.IO server for broadcasting deletions
 *
 * Schedule (runs once daily at midnight):
 *   Day 24  → send pre-deletion warning notification to both parties (private msgs only)
 *   Day 25+ → delete the message, remove voice file from disk, emit messageDeleted event
 */
function startMessageCleanup(io) {
  cron.schedule('0 0 * * *', async () => {
    try {
      const now = new Date();
      const cutoff24 = new Date(now.getTime() - 24 * 24 * 60 * 60 * 1000); // 24 days ago
      const cutoff25 = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000); // 25 days ago

      // ── Step 1: Warn participants of private messages expiring in ~1 day ──────
      const toNotify = await ChatMessage.findAll({
        where: {
          isPrivate: true,
          preDeletionNotified: false,
          createdAt: { [Op.lte]: cutoff24 },
        },
      });

      for (const msg of toNotify) {
        const warningText =
          'A private message you sent or received will be automatically deleted in about 1 day ' +
          'as part of our 25-day message retention policy.';

        // Notify sender
        await Notification.create({
          userId: msg.senderId,
          userType: msg.senderType,
          title: 'Message expiring soon',
          message: warningText,
        });

        // Notify receiver (if private message has one)
        if (msg.receiverId && msg.receiverType) {
          await Notification.create({
            userId: msg.receiverId,
            userType: msg.receiverType,
            title: 'Message expiring soon',
            message: warningText,
          });
        }

        await msg.update({ preDeletionNotified: true });
      }

      if (toNotify.length > 0) {
        console.log(`[cleanupMessages] Sent expiry warnings for ${toNotify.length} message(s).`);
      }

      // ── Step 2: Delete all messages older than 25 days ───────────────────────
      const toDelete = await ChatMessage.findAll({
        where: { createdAt: { [Op.lte]: cutoff25 } },
      });

      for (const msg of toDelete) {
        // Remove voice file from disk if present
        if (msg.mediaUrl) {
          const filePath = path.join(__dirname, '..', msg.mediaUrl);
          fs.unlink(filePath, (err) => {
            if (err && err.code !== 'ENOENT') {
              console.error('[cleanupMessages] Failed to delete voice file:', filePath, err.message);
            }
          });
        }

        const msgId = msg.id;
        await msg.destroy();
        // Broadcast deletion so open chat sessions remove the message in real time
        io.emit('messageDeleted', { id: msgId });
      }

      if (toDelete.length > 0) {
        console.log(`[cleanupMessages] Deleted ${toDelete.length} expired message(s).`);
      }
    } catch (error) {
      console.error('[cleanupMessages] Error during message cleanup:', error);
    }
  });

  console.log('[cleanupMessages] Message cleanup scheduler started (runs daily at midnight).');
}

module.exports = { startMessageCleanup };
