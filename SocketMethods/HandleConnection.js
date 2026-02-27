const Admin = require("../models/Admin");
const ChatMessage = require("../models/ChatMessage");
const Notification = require("../models/Notifications");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const { Op } = require("sequelize");

const onlineUsers = new Map();

const handleConnection = (socket, io) => {
  // -------------------------------------------------------------------------
  // userConnected — track online users (students, teachers, AND admins)
  // -------------------------------------------------------------------------
  socket.on("userConnected", async (data) => {
    const { userId, userType } = data;
    try {
      let userDetails;
      if (userType === "student") {
        userDetails = await Student.findByPk(userId);
      } else if (userType === "teacher") {
        userDetails = await Teacher.findByPk(userId);
      } else if (userType === "admin") {
        userDetails = await Admin.findByPk(userId);
      }

      if (!userDetails) return;

      const userKey = `${userType}-${userId}`;

      onlineUsers.set(userKey, {
        socketId: socket.id,
        userType,
        details: userDetails,
      });

      io.emit("onlineUsers", Array.from(onlineUsers.values()));

      // Join a personal room for targeted delivery
      socket.join(userKey);

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
    const { message, senderId, senderType } = data;
    try {
      const savedMessage = await ChatMessage.create({
        message,
        senderId,
        senderType,
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
          attributes: ["id", "name", "username"],
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
  // Rule: only admin can START a new conversation; others can only reply to
  //       an existing admin-initiated conversation.
  // -------------------------------------------------------------------------
  socket.on("privateMessage", async (data) => {
    const { message, senderId, senderType, receiverId, receiverType } = data;

    try {
      // Enforce admin-mediated rule: if sender is not admin, a prior message
      // between these two parties must already exist.
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
            message:
              "Only admin can start a new private conversation. You can only reply to existing ones.",
          });
          return;
        }
      }

      const savedMessage = await ChatMessage.create({
        message,
        senderId,
        senderType,
        receiverId,
        receiverType,
        isPrivate: true,
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
          attributes: ["id", "name", "username"],
        });
      }

      const enrichedMsg = {
        ...savedMessage.toJSON(),
        senderDetails,
      };

      // Deliver ONLY to the two parties via their personal rooms
      const senderKey = `${senderType}-${senderId}`;
      const receiverKey = `${receiverType}-${receiverId}`;
      io.to(senderKey).emit("privateMessageSent", enrichedMsg);
      io.to(receiverKey).emit("privateMessageSent", enrichedMsg);
    } catch (error) {
      console.error("Error handling privateMessage:", error);
    }
  });

  // -------------------------------------------------------------------------
  // deleteMessage — only message owner or admin can delete
  // Payload: { messageId, requesterId, requesterType }
  // -------------------------------------------------------------------------
  socket.on("deleteMessage", async (data) => {
    // Support both old format (plain messageId number) and new format (object)
    let messageId, requesterId, requesterType;
    if (data && typeof data === "object" && "messageId" in data) {
      ({ messageId, requesterId, requesterType } = data);
    } else {
      // Legacy: plain messageId (no authorization check possible)
      messageId = data;
      requesterId = null;
      requesterType = null;
    }

    try {
      const message = await ChatMessage.findByPk(messageId);
      if (!message) return;

      // Authorization check
      if (requesterId !== null && requesterType !== null) {
        const isOwner =
          message.senderId === parseInt(requesterId) &&
          message.senderType === requesterType;
        const isAdmin = requesterType === "admin";

        if (!isOwner && !isAdmin) {
          socket.emit("chatError", {
            message: "You are not authorized to delete this message.",
          });
          return;
        }
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
    for (const [userId, userData] of onlineUsers.entries()) {
      if (userData.socketId === socket.id) {
        onlineUsers.delete(userId);
        io.emit("onlineUsers", Array.from(onlineUsers.values()));
        break;
      }
    }
  });
};

module.exports = { handleConnection, onlineUsers };
