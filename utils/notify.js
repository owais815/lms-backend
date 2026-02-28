const Notification = require("../models/Notifications");
const { getIO } = require("../socket");
const { onlineUsers } = require("../SocketMethods/HandleConnection");

/**
 * Create a notification record and emit it in real-time if the user is online.
 * @param {{ userId: number|string, userType: string, title: string, message: string }} opts
 */
const notify = async ({ userId, userType, title, message }) => {
  try {
    const record = await Notification.create({ userId, userType, title, message });
    let io;
    try { io = await getIO(); } catch { /* socket not ready */ }
    if (io) {
      const key = `${userType}-${userId}`;
      if (onlineUsers.has(key)) {
        io.to(onlineUsers.get(key).socketId).emit("newNotification", record);
      }
    }
    return record;
  } catch (err) {
    console.error("notify error:", err);
  }
};

module.exports = notify;
