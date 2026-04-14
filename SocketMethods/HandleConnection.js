const Admin = require("../models/Admin");
const ChatMessage = require("../models/ChatMessage");
const ChatGroupMember = require("../models/ChatGroupMember");
const Notification = require("../models/Notifications");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Parent = require("../models/Parent");
const { Op } = require("sequelize");

const onlineUsers = new Map();

const handleConnection = (socket, io) => {
  // -------------------------------------------------------------------------
  // userConnected — track online users
  // userId/userType are trusted from JWT (set by socket.js middleware) but
  // clients still send them explicitly for backward compat with the UI.
  // We cross-check against socket.userId to prevent impersonation.
  // -------------------------------------------------------------------------
  socket.on("userConnected", async (data) => {
    const { userId, userType } = data;

    // Reject if the claimed identity doesn't match the authenticated token
    if (String(userId) !== String(socket.userId)) {
      socket.emit("chatError", { message: "Identity mismatch." });
      return;
    }

    try {
      let userDetails;
      if (userType === "student") {
        userDetails = await Student.findByPk(userId, {
          attributes: ["id", "firstName", "lastName", "username", "profileImg"],
        });
      } else if (userType === "teacher") {
        userDetails = await Teacher.findByPk(userId, {
          attributes: ["id", "firstName", "lastName", "username", "imageUrl"],
        });
      } else if (userType === "admin") {
        userDetails = await Admin.findByPk(userId, {
          attributes: ["id", "name", "username"],
        });
      } else if (userType === "parent") {
        userDetails = await Parent.findByPk(userId, {
          attributes: ["id", "firstName", "lastName", "username"],
        });
      }

      if (!userDetails) return;

      const userKey = `${userType}-${userId}`;

      onlineUsers.set(userKey, {
        socketId: socket.id,
        userType,
        // Only include non-sensitive fields in the presence list
        userId: String(userId),
        displayName: userType === "admin"
          ? userDetails.name
          : `${userDetails.firstName} ${userDetails.lastName || ""}`.trim(),
      });

      // Emit the updated presence list ONLY to admin sockets, not to everyone
      for (const [, u] of onlineUsers) {
        if (u.userType === "admin") {
          io.to(`admin-${u.userId}`).emit("onlineUsers", Array.from(onlineUsers.values()));
        }
      }
      // Send the current list back to the connecting socket
      socket.emit("onlineUsers", Array.from(onlineUsers.values()));

      // Join a personal room for targeted delivery
      socket.join(userKey);

      // Join all group rooms this user belongs to
      try {
        const memberships = await ChatGroupMember.findAll({ where: { userId, userType } });
        memberships.forEach(m => socket.join(`group-${m.groupId}`));
      } catch (_) {}

      // Send unread notifications on connect
      try {
        const unreadNotifications = await Notification.findAll({
          where: { userId, userType, isRead: false },
        });
        socket.emit("unreadNotifications", unreadNotifications);
      } catch (error) {
        console.error("Error fetching unread notifications:", error);
      }
    } catch (error) {
      console.error("Error in userConnected:", error);
    }
  });

  // -------------------------------------------------------------------------
  // sendNotification — persist + deliver to online user
  // -------------------------------------------------------------------------
  socket.on("sendNotification", async (data) => {
    const { userId, userType, title, message } = data;
    const userKey = `${userType}-${userId}`;

    try {
      const notification = await Notification.create({
        userId,
        userType,
        title,
        message,
      });

      if (onlineUsers.has(userKey)) {
        const userSocketId = onlineUsers.get(userKey).socketId;
        io.to(userSocketId).emit("newNotification", notification);
      }
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  });

  // -------------------------------------------------------------------------
  // chatMessage — public group message, broadcast to ALL
  // -------------------------------------------------------------------------
  socket.on("chatMessage", async (data) => {
    const { message, senderId, senderType, messageType, mediaUrl, mediaDuration } = data;

    // Verify sender identity against authenticated socket
    if (String(senderId) !== String(socket.userId)) {
      socket.emit("chatError", { message: "Identity mismatch." });
      return;
    }

    // Only admins can post to the Announcements channel
    if (senderType !== "admin") {
      socket.emit("chatError", { message: "Only admins can post announcements." });
      return;
    }

    try {
      const savedMessage = await ChatMessage.create({
        message: message || '',
        senderId,
        senderType,
        messageType: messageType || 'text',
        mediaUrl: mediaUrl || null,
        mediaDuration: mediaDuration || null,
      });

      let senderDetails;
      if (senderType === "student") {
        senderDetails = await Student.findByPk(senderId, {
          attributes: ["id", "firstName", "lastName", "username", "profileImg"],
        });
      } else if (senderType === "teacher") {
        senderDetails = await Teacher.findByPk(senderId, {
          attributes: ["id", "firstName", "lastName", "username", "imageUrl"],
        });
      } else if (senderType === "admin") {
        senderDetails = await Admin.findByPk(senderId, {
          attributes: ["id", "name", "username", "profileImg"],
        });
      }

      if (senderDetails) {
        io.emit("newMessage", {
          ...savedMessage.toJSON(),
          senderDetails,
        });
      } else {
        console.error("Sender details not found for chatMessage");
      }
    } catch (error) {
      console.error("Error handling chatMessage:", error);
    }
  });

  // -------------------------------------------------------------------------
  // privateMessage — 1:1 message, only to sender + receiver rooms
  // -------------------------------------------------------------------------
  socket.on("privateMessage", async (data) => {
    const { message, senderId, senderType, receiverId, receiverType, messageType, mediaUrl, mediaDuration } = data;

    // Verify sender identity against authenticated socket
    if (String(senderId) !== String(socket.userId)) {
      socket.emit("chatError", { message: "Identity mismatch." });
      return;
    }

    try {
      // Enforce admin-mediated rule: only admin can START a conversation
      if (senderType !== "admin") {
        const priorMessage = await ChatMessage.findOne({
          where: {
            isPrivate: true,
            [Op.or]: [
              { senderId, senderType, receiverId, receiverType },
              {
                senderId: receiverId,
                senderType: receiverType,
                receiverId: senderId,
                receiverType: senderType,
              },
            ],
          },
        });

        if (!priorMessage) {
          socket.emit("chatError", {
            message: "Only admin can start a new private conversation. You can only reply to existing ones.",
          });
          return;
        }
      }

      const savedMessage = await ChatMessage.create({
        message: message || '',
        senderId,
        senderType,
        receiverId,
        receiverType,
        isPrivate: true,
        messageType: messageType || 'text',
        mediaUrl: mediaUrl || null,
        mediaDuration: mediaDuration || null,
      });

      let senderDetails;
      if (senderType === "student") {
        senderDetails = await Student.findByPk(senderId, {
          attributes: ["id", "firstName", "lastName", "username", "profileImg"],
        });
      } else if (senderType === "teacher") {
        senderDetails = await Teacher.findByPk(senderId, {
          attributes: ["id", "firstName", "lastName", "username", "imageUrl"],
        });
      } else if (senderType === "admin") {
        senderDetails = await Admin.findByPk(senderId, {
          attributes: ["id", "name", "username", "profileImg"],
        });
      } else if (senderType === "parent") {
        senderDetails = await Parent.findByPk(senderId, {
          attributes: ["id", "firstName", "lastName", "username", "profileImg"],
        });
      }

      const enrichedMsg = { ...savedMessage.toJSON(), senderDetails };

      const senderKey = `${senderType}-${senderId}`;
      const receiverKey = `${receiverType}-${receiverId}`;
      io.to(senderKey).emit("privateMessageSent", enrichedMsg);
      io.to(receiverKey).emit("privateMessageSent", enrichedMsg);
    } catch (error) {
      console.error("Error handling privateMessage:", error);
    }
  });

  // -------------------------------------------------------------------------
  // groupMessage — message to a specific chat group
  // -------------------------------------------------------------------------
  socket.on("groupMessage", async (data) => {
    const { groupId, senderId, senderType, message, messageType, mediaUrl, mediaDuration } = data;

    // Verify sender identity against authenticated socket
    if (String(senderId) !== String(socket.userId)) {
      socket.emit("chatError", { message: "Identity mismatch." });
      return;
    }

    try {
      const membership = await ChatGroupMember.findOne({
        where: { groupId, userId: senderId, userType: senderType },
      });
      if (!membership) {
        socket.emit("chatError", { message: "You are not a member of this group." });
        return;
      }
      if (!membership.canSend) {
        socket.emit("chatError", { message: "You are not allowed to send messages in this group." });
        return;
      }

      const savedMessage = await ChatMessage.create({
        message: message || '',
        senderId,
        senderType,
        groupId,
        messageType: messageType || 'text',
        mediaUrl: mediaUrl || null,
        mediaDuration: mediaDuration || null,
      });

      let senderDetails;
      if (senderType === "student") {
        senderDetails = await Student.findByPk(senderId, { attributes: ["id", "firstName", "lastName", "username", "profileImg"] });
      } else if (senderType === "teacher") {
        senderDetails = await Teacher.findByPk(senderId, { attributes: ["id", "firstName", "lastName", "username", "imageUrl"] });
      } else if (senderType === "admin") {
        senderDetails = await Admin.findByPk(senderId, { attributes: ["id", "name", "username", "profileImg"] });
      }

      io.to(`group-${groupId}`).emit("newGroupMessage", {
        ...savedMessage.toJSON(),
        senderDetails,
      });
    } catch (error) {
      console.error("Error handling groupMessage:", error);
    }
  });

  // -------------------------------------------------------------------------
  // joinGroup / leaveGroup
  // -------------------------------------------------------------------------
  socket.on("joinGroup", ({ groupId }) => {
    if (groupId) socket.join(`group-${groupId}`);
  });

  socket.on("leaveGroup", ({ groupId }) => {
    if (groupId) socket.leave(`group-${groupId}`);
  });

  // -------------------------------------------------------------------------
  // deleteMessage — only message owner or admin can delete.
  // Always requires { messageId, requesterId, requesterType } — legacy plain
  // number format is no longer accepted to prevent unauthorized deletion.
  // -------------------------------------------------------------------------
  socket.on("deleteMessage", async (data) => {
    if (!data || typeof data !== "object" || !("messageId" in data)) {
      socket.emit("chatError", { message: "Invalid deleteMessage payload." });
      return;
    }

    const { messageId, requesterId, requesterType } = data;

    // Verify identity against authenticated socket
    if (String(requesterId) !== String(socket.userId)) {
      socket.emit("chatError", { message: "Identity mismatch." });
      return;
    }

    try {
      const message = await ChatMessage.findByPk(messageId);
      if (!message) return;

      const isOwner =
        message.senderId === parseInt(requesterId) &&
        message.senderType === requesterType;
      const isAdmin = requesterType === "admin";

      if (!isOwner && !isAdmin) {
        socket.emit("chatError", { message: "You are not authorized to delete this message." });
        return;
      }

      await message.destroy();
      io.emit("messageDeleted", { id: messageId });
    } catch (error) {
      console.error("Error handling deleteMessage:", error);
    }
  });

  // -------------------------------------------------------------------------
  // Session subscription — for live class session notifications
  // -------------------------------------------------------------------------
  socket.on("subscribe:sessions", (sessionIds) => {
    if (!Array.isArray(sessionIds)) return;
    sessionIds.forEach((id) => {
      if (id) socket.join(`session-${id}`);
    });
  });

  socket.on("unsubscribe:sessions", (sessionIds) => {
    if (!Array.isArray(sessionIds)) return;
    sessionIds.forEach((id) => {
      if (id) socket.leave(`session-${id}`);
    });
  });

  // -------------------------------------------------------------------------
  // disconnect — remove from online users map
  // -------------------------------------------------------------------------
  socket.on("disconnect", () => {
    for (const [userKey, userData] of onlineUsers.entries()) {
      if (userData.socketId === socket.id) {
        onlineUsers.delete(userKey);
        // Notify admins of updated presence list
        for (const [, u] of onlineUsers) {
          if (u.userType === "admin") {
            io.to(`admin-${u.userId}`).emit("onlineUsers", Array.from(onlineUsers.values()));
          }
        }
        break;
      }
    }
  });
};

module.exports = { handleConnection, onlineUsers };
