const express = require('express');
const ChatMessage = require('../models/ChatMessage');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Admin = require('../models/Admin');
const Parent = require('../models/Parent');
const { Op } = require('sequelize');
const sequelize = require("../utils/database");
const isAuth = require('../middleware/is-auth');
const router = express.Router();

// Helper: batch-fetch sender details in 3 queries instead of N queries
async function enrichWithSenderDetails(messages) {
  const studentIds = [...new Set(messages.filter(m => m.senderType === 'student').map(m => m.senderId))];
  const teacherIds = [...new Set(messages.filter(m => m.senderType === 'teacher').map(m => m.senderId))];
  const adminIds   = [...new Set(messages.filter(m => m.senderType === 'admin').map(m => m.senderId))];

  const [students, teachers, admins] = await Promise.all([
    studentIds.length ? Student.findAll({ where: { id: studentIds }, attributes: ['id', 'firstName', 'lastName', 'username', 'profileImg'] }) : [],
    teacherIds.length ? Teacher.findAll({ where: { id: teacherIds }, attributes: ['id', 'firstName', 'lastName', 'username', 'imageUrl'] }) : [],
    adminIds.length   ? Admin.findAll({ where: { id: adminIds }, attributes: ['id', 'name', 'username'] }) : [],
  ]);

  const studentMap = Object.fromEntries(students.map(s => [s.id, s.toJSON()]));
  const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t.toJSON()]));
  const adminMap   = Object.fromEntries(admins.map(a => [a.id, a.toJSON()]));

  return messages.map(msg => ({
    ...(msg.toJSON ? msg.toJSON() : msg),
    senderDetails:
      msg.senderType === 'student' ? (studentMap[msg.senderId] ?? null) :
      msg.senderType === 'teacher' ? (teacherMap[msg.senderId] ?? null) :
      msg.senderType === 'admin'   ? (adminMap[msg.senderId] ?? null) : null,
  }));
}

router.get('/messages', async (req, res) => {
  try {
    const messages = await ChatMessage.findAll({
      where: { isPrivate: false },
      order: [['createdAt', 'ASC']],
    });

    const enrichedMessages = await enrichWithSenderDetails(messages);
    res.json({ messages: enrichedMessages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

router.get('/private-messages/:userId/:userType', async (req, res) => {
  const { userId, userType } = req.params;
  try {
    const messages = await ChatMessage.findAll({
      where: {
        isPrivate: true,
        [Op.or]: [
          { senderId: userId, senderType: userType },
          { receiverId: userId, receiverType: userType },
        ],
      },
      order: [['createdAt', 'ASC']],
    });

    const enrichedMessages = await enrichWithSenderDetails(messages);
    res.status(200).json(enrichedMessages);
  } catch (error) {
    console.error('Error fetching private messages:', error);
    res.status(500).json({ error: 'Failed to fetch private messages' });
  }
});

router.get('/recent-chats/:userId/:userType', async (req, res) => {
  const { userId, userType } = req.params;

  try {
    const recentUsers = await sequelize.query(
      `
        SELECT cm.*
        FROM ChatMessages cm
        INNER JOIN (
          SELECT
            CASE
              WHEN senderId = :userId AND senderType = :userType THEN receiverId
              ELSE senderId
            END AS otherUserId,
            CASE
              WHEN senderId = :userId AND senderType = :userType THEN receiverType
              ELSE senderType
            END AS otherUserType,
            MAX(createdAt) AS latestMessageTime
          FROM ChatMessages
          WHERE isPrivate = true
          AND (
            (receiverId = :userId AND receiverType = :userType)
            OR (senderId = :userId AND senderType = :userType)
          )
          GROUP BY otherUserId, otherUserType
          ORDER BY latestMessageTime DESC
          LIMIT 100
        ) AS latestMessages
        ON (
          (cm.senderId = :userId AND cm.senderType = :userType AND cm.receiverId = latestMessages.otherUserId AND cm.receiverType = latestMessages.otherUserType)
          OR
          (cm.receiverId = :userId AND cm.receiverType = :userType AND cm.senderId = latestMessages.otherUserId AND cm.senderType = latestMessages.otherUserType)
        )
        AND cm.createdAt = latestMessages.latestMessageTime
        ORDER BY cm.createdAt DESC
      `,
      {
        replacements: { userId, userType },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    // Batch-fetch other user details: collect unique IDs per type
    const otherUserIds = recentUsers.map(msg => {
      const isUserSender = msg.senderId === parseInt(userId) && msg.senderType === userType;
      return {
        id: isUserSender ? msg.receiverId : msg.senderId,
        type: isUserSender ? msg.receiverType : msg.senderType,
      };
    });

    const studentIds = [...new Set(otherUserIds.filter(u => u.type === 'student').map(u => u.id))];
    const teacherIds = [...new Set(otherUserIds.filter(u => u.type === 'teacher').map(u => u.id))];
    const adminIds   = [...new Set(otherUserIds.filter(u => u.type === 'admin').map(u => u.id))];

    const [students, teachers, admins] = await Promise.all([
      studentIds.length ? Student.findAll({ where: { id: studentIds }, attributes: ['id', 'firstName', 'lastName', 'username', 'profileImg'] }) : [],
      teacherIds.length ? Teacher.findAll({ where: { id: teacherIds }, attributes: ['id', 'firstName', 'lastName', 'username', 'imageUrl'] }) : [],
      adminIds.length   ? Admin.findAll({ where: { id: adminIds }, attributes: ['id', 'name', 'username'] }) : [],
    ]);

    const studentMap = Object.fromEntries(students.map(s => [s.id, { ...s.toJSON(), userType: 'student' }]));
    const teacherMap = Object.fromEntries(teachers.map(t => [t.id, { ...t.toJSON(), userType: 'teacher' }]));
    const adminMap   = Object.fromEntries(admins.map(a => [a.id, { ...a.toJSON(), userType: 'admin' }]));

    const finalResponse = recentUsers.map(msg => {
      const isUserSender = msg.senderId === parseInt(userId) && msg.senderType === userType;
      const otherId   = isUserSender ? msg.receiverId : msg.senderId;
      const otherType = isUserSender ? msg.receiverType : msg.senderType;

      const otherUserDetails =
        otherType === 'student' ? (studentMap[otherId] ?? null) :
        otherType === 'teacher' ? (teacherMap[otherId] ?? null) :
        otherType === 'admin'   ? (adminMap[otherId] ?? null) : null;

      return { ...msg, otherUserDetails };
    });

    res.status(200).json(finalResponse);
  } catch (error) {
    console.error('Error fetching recent chats:', error);
    res.status(500).json({ error: 'Failed to fetch recent chats' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/chat/users — list all users for admin's "start conversation" picker
// Returns a unified array normalised to { id, displayName, username, userType, avatarUrl }
// ---------------------------------------------------------------------------
router.get('/users', isAuth, async (req, res) => {
  try {
    const [students, teachers, admins, parents] = await Promise.all([
      Student.findAll({ attributes: ['id', 'firstName', 'lastName', 'username', 'profileImg'] }),
      Teacher.findAll({ attributes: ['id', 'firstName', 'lastName', 'username', 'imageUrl'] }),
      Admin.findAll({ attributes: ['id', 'name', 'username'] }),
      Parent.findAll({ attributes: ['id', 'firstName', 'lastName', 'username'] }),
    ]);

    const normalised = [
      ...students.map(s => ({
        id: s.id,
        displayName: `${s.firstName} ${s.lastName || ''}`.trim(),
        username: s.username,
        userType: 'student',
        avatarUrl: s.profileImg || null,
      })),
      ...teachers.map(t => ({
        id: t.id,
        displayName: `${t.firstName} ${t.lastName || ''}`.trim(),
        username: t.username,
        userType: 'teacher',
        avatarUrl: t.imageUrl || null,
      })),
      ...admins.map(a => ({
        id: a.id,
        displayName: a.name,
        username: a.username,
        userType: 'admin',
        avatarUrl: null,
      })),
      ...parents.map(p => ({
        id: p.id,
        displayName: `${p.firstName} ${p.lastName || ''}`.trim(),
        username: p.username,
        userType: 'parent',
        avatarUrl: null,
      })),
    ];

    res.json({ users: normalised });
  } catch (error) {
    console.error('Error fetching chat users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

module.exports = router;
