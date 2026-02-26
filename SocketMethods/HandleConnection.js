const Admin = require("../models/Admin");
const ChatMessage = require("../models/ChatMessage");
const Notification = require("../models/Notifications");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");

// socketHandlers.js
const onlineUsers = new Map();
const handleConnection = (socket, io) => {
  socket.on("userConnected", async (data) => {
    const { userId, userType } = data;
    try {
      // Get user details from database
      // console.log("user connected  event working.Alhamdullilah..Allah o Akbar!!!");

      let userDetails;
      if (userType === "student") {
        userDetails = await Student.findByPk(userId);
      } else if (userType === "teacher") {
        userDetails = await Teacher.findByPk(userId);
      }
      if (!userDetails) {
        // console.log("No user details found for:", userId);
        return;
      }
      // Create a unique composite key
      const userKey = `${userType}-${userId}`;
      // Store user in online users map
      if (userType === "student" || userType === "teacher") {
        // console.log(`${userType} with ID ${userId} connected`);

        onlineUsers.set(userKey, {
          socketId: socket.id,
          userType,
          details: userDetails,
        });

        // Send updated online users list to all clients
        io.emit("onlineUsers", Array.from(onlineUsers.values()));

        // Join a room for targeted notifications
        socket.join(userKey);
        // Fetch unread notifications and send them
        try {
          const unreadNotifications = await Notification.findAll({
            where: { userId, userType, isRead: false },
          });

          socket.emit("unreadNotifications", unreadNotifications);
        } catch (error) {
          console.error("Error fetching unread notifications:", error);
        }
      }
    } catch (error) {
      console.error("Error:", error);
    }
  });

  //for sending notifications
  socket.on("sendNotification", async (data) => {
    const { userId, userType, title, message } = data;
    const userKey = `${userType}-${userId}`;

    try {
      // Store notification in the database
      const notification = await Notification.create({
        userId,
        userType,
        title,
        message,
      });

      // Check if user is online
      if (onlineUsers.has(userKey)) {
        const userSocketId = onlineUsers.get(userKey).socketId;
        io.to(userSocketId).emit("newNotification", notification);
      }
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  });

  socket.on("chatMessage", async (data) => {
    const { message, senderId, senderType } = data;
    try {
      const savedMessage = await ChatMessage.create({
        message,
        senderId,
        senderType,
      });
      // console.log("chat message event working...!!!",message,senderId,senderType);
      // Fetch sender details based on senderType
      let senderDetails;
      if (senderType === "student") {
        senderDetails = await Student.findByPk(senderId, {
          attributes: ["id", "firstName", "lastName", "username", "profileImg"],
        });
        // console.log("sender details are::",senderDetails)
      } else if (senderType === "teacher") {
        senderDetails = await Teacher.findByPk(senderId, {
          attributes: ["id", "firstName", "lastName", "username", "imageUrl"],
        });
      } else if (senderType === "admin") {
        senderDetails = await Admin.findByPk(senderId, {
          attributes: ["name", "username"],
        });
      }

      if (senderDetails) {
        // Combine message data with user details before broadcasting
        const enrichedMessage = {
          ...savedMessage.toJSON(),
          senderDetails,
        };
        io.emit("newMessage", enrichedMessage);
      } else {
        console.error("Sender details not found");
      }
    } catch (error) {
      console.error("Error handling chat message:", error);
    }
  });

  socket.on("privateMessage", async (data) => {
    const { message, senderId, senderType, receiverId, receiverType } = data;

    try {
      // Save the message to the database
      const savedMessage = await ChatMessage.create({
        message,
        senderId,
        senderType,
        receiverId,
        receiverType,
        isPrivate: true,
      });

      // Fetch sender details for display purposes
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
          attributes: ["name", "username"],
        });
      }

      // Emit the message to the recipient
      // Note: If the user is not online, they won't receive this in real-time,
      // but you can load messages from the database when they connect or reload.
      // io.to(socket.id).emit('privateMessage', {
      //   ...savedMessage.toJSON(),
      //   senderDetails
      // });

      // Optionally emit to the sender to confirm message delivery
      // socket.emit('privateMessageSent', { ...savedMessage.toJSON() });
      io.emit("privateMessageSent", {
        ...savedMessage.toJSON(),
        senderDetails,
      });
    } catch (error) {
      console.error("Error handling privateMessage:", error);
    }
  });

  // New event listener for 'deleteMessage'
  socket.on("deleteMessage", async (messageId) => {
    try {
      // Find the message by ID
      const message = await ChatMessage.findByPk(messageId);
      if (!message) {
        return; // If no message is found, simply return
      }

      // Delete the message
      await message.destroy();

      // Emit the 'messageDeleted' event to all clients
      io.emit("messageDeleted", { id: messageId });
    } catch (error) {
      console.error("Error handling deleteMessage event:", error);
    }
  });

  // -------------------------------------------------------------------------
  // Session subscription — client joins a Socket.IO room per session ID
  // so it receives session:started / session:ended events for those sessions.
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

  socket.on("disconnect", () => {
    // console.log("i am going to disconnect", onlineUsers);
    for (const [userId, userData] of onlineUsers.entries()) {
      if (userData.socketId === socket.id) {
        onlineUsers.delete(userId);
        // Notify all clients about user disconnection
        io.emit("onlineUsers", Array.from(onlineUsers.values()));
        break;
      }
    }
  });
};

module.exports = { handleConnection,onlineUsers };
