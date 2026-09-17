const Notification = require("../models/Notifications");
const { getIO } = require("../socket");
const { onlineUsers } = require("../SocketMethods/HandleConnection");
const registry = require("../notifications/registry");
const settings = require("../notifications/settings/cache");

/**
 * Resolve which registry event a notification belongs to.
 *
 * Callers may pass `eventKey` explicitly. Most do not, so the title is mapped
 * back to its event instead — every title the backend emits is declared on an
 * event's `titles` list, and scripts/check-notification-events.js fails the
 * build if one drifts out of the registry.
 *
 * @returns {string|null} null when nothing matches, which means "always send"
 */
const resolveEventKey = (eventKey, title) =>
  eventKey || registry.getEventKeyForTitle(title);

/**
 * Create a notification record and emit it in real-time if the user is online.
 *
 * Returns undefined without writing anything when an admin has switched this
 * event off, or has narrowed it to audiences that exclude this recipient.
 * Events marked `transactional` in the registry ignore those settings — see
 * notifications/settings/store.js.
 *
 * @param {{ userId: number|string, userType: string, title: string, message: string,
 *           priority?: 'critical'|'warning'|'info', eventKey?: string }} opts
 */
const notify = async ({ userId, userType, title, message, priority = 'info', eventKey }) => {
  try {
    const key = resolveEventKey(eventKey, title);
    if (!settings.isEnabled(key, userType)) return undefined;

    const record = await Notification.create({ userId, userType, title, message, priority });
    let io;
    try { io = await getIO(); } catch { /* socket not ready */ }
    if (io) {
      const socketKey = `${userType}-${userId}`;
      if (onlineUsers.has(socketKey)) {
        io.to(onlineUsers.get(socketKey).socketId).emit("newNotification", record);
      }
    }
    return record;
  } catch (err) {
    console.error("notify error:", err);
  }
};

// Exposed so notifyBulk can filter a batch without a round trip per row.
notify.resolveEventKey = resolveEventKey;

module.exports = notify;
