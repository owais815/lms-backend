const express = require('express');
const {body} = require('express-validator');
const quizController = require('../controllers/quiz');
const ChatMessage = require('../models/ChatMessage');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Admin = require('../models/Admin');
const { Op,Sequelize } = require('sequelize');
const sequelize = require("../utils/database");
const router = express.Router();

// Create a new quiz
router.get('/messages',async(req,res,next)=>{
    try {
        // Fetch all chat messages
        const messages = await ChatMessage.findAll({
            where: { isPrivate: false },
          order: [['createdAt', 'ASC']], 
        });
    
        // Enrich messages with user details
        const enrichedMessages = await Promise.all(
          messages.map(async (msg) => {
            let senderDetails;
            if (msg.senderType === 'student') {
              senderDetails = await Student.findByPk(msg.senderId, {
                attributes: ['id','firstName','lastName','username', 'profileImg'],
              });
            } else if (msg.senderType === 'teacher') {
              senderDetails = await Teacher.findByPk(msg.senderId, {
                attributes: ['id','firstName','lastName','username', 'imageUrl'],
              });
            } else if (msg.senderType === 'admin') {
              senderDetails = await Admin.findByPk(msg.senderId, {
                attributes: ['name', 'username'],
              });
            }
    
            return {
              ...msg.toJSON(),
              senderDetails
            };
          })
        );
    
        res.json({ messages: enrichedMessages });
      } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Failed to fetch messages' });
      }
});

router.get('/private-messages/:userId/:userType', async (req, res) => {
    const { userId, userType } = req.params;
    try {
      // Fetch all messages where the user is either the sender or the receiver
      const messages = await ChatMessage.findAll({
        where: {
          isPrivate: true,
          [Op.or]: [
            { senderId: userId, senderType: userType },
            { receiverId: userId, receiverType: userType },
          ],
        },
        order: [['createdAt', 'ASC']], // Sort messages if needed
      });
      const enrichedMessages = await Promise.all(
        messages.map(async (msg) => {
          let senderDetails;
          if (msg.senderType === 'student') {
            senderDetails = await Student.findByPk(msg.senderId, {
              attributes: ['id','firstName','lastName','username', 'profileImg'],
            });
          } else if (msg.senderType === 'teacher') {
            senderDetails = await Teacher.findByPk(msg.senderId, {
              attributes: ['id','firstName','lastName','username', 'imageUrl'],
            });
          } else if (msg.senderType === 'admin') {
            senderDetails = await Admin.findByPk(msg.senderId, {
              attributes: ['name', 'username'],
            });
          }
  
          return {
            ...msg.toJSON(),
            senderDetails
          };
        })
      );
      res.status(200).json(enrichedMessages);
    } catch (error) {
      console.error('Error fetching private messages:', error);
      res.status(500).json({ error: 'Failed to fetch private messages' });
    }
  });

//   router.get('/recent-chats/:userId/:userType', async (req, res) => {
//     const { userId, userType } = req.params;
//     try {
//       const recentChats = await sequelize.query(
//         `
//           SELECT cm.id, cm.message, cm.senderId, cm.senderType, cm.receiverId, cm.receiverType, cm.createdAt
//           FROM ChatMessages cm
//           WHERE cm.isPrivate = true
//           AND (
//             (cm.receiverId = :userId AND cm.receiverType = :userType)
//             OR (cm.senderId = :userId AND cm.senderType = :userType)
//           )
//           AND cm.createdAt = (
//             SELECT MAX(createdAt)
//             FROM ChatMessages
//             WHERE (senderId = cm.senderId AND receiverId = cm.receiverId)
//             OR (senderId = cm.receiverId AND receiverId = cm.senderId)
//             AND isPrivate = true
//           )
//           ORDER BY cm.createdAt DESC
//         `,
//         {
//           replacements: { userId, userType },
//           type: sequelize.QueryTypes.SELECT,
//         }
//       );
//       const finalResponse = await Promise.all(
//         recentChats.map(async (msg) => {
//           let senderDetails;
//           if (msg.senderType === 'student') {
//             senderDetails = await Student.findByPk(msg.senderId, {
//               attributes: ['id','firstName','lastName','username', 'profileImg'],
//             });
//           } else if (msg.senderType === 'teacher') {
//             senderDetails = await Teacher.findByPk(msg.senderId, {
//               attributes: ['id','firstName','lastName','username', 'imageUrl'],
//             });
//           } else if (msg.senderType === 'admin') {
//             senderDetails = await Admin.findByPk(msg.senderId, {
//               attributes: ['name', 'username'],
//             });
//           }
  
//           return {
//             ...msg,
//             senderDetails
//           };
//         })
//       );
//       res.status(200).json(finalResponse);
//     } catch (error) {
//       console.error('Error fetching recent chats:', error);
//       res.status(500).json({ error: 'Failed to fetch recent chats' });
//     }
//   });

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
   
      const finalResponse = await Promise.all(
        recentUsers.map(async (msg) => {
            let otherUserDetails;
    
            // Determine if the other user is the sender or receiver
            const isUserSender = msg.senderId === parseInt(userId) && msg.senderType === userType;
    
            // Fetch details for the "other" user based on the role and ID
            if (isUserSender) {
                // If the user is the sender, get the receiver's details
                if (msg.receiverType === 'student') {
                    otherUserDetails = await Student.findByPk(msg.receiverId, {
                        attributes: ['id', 'firstName', 'lastName', 'username', 'profileImg'],
                    });
                    otherUserDetails = { ...otherUserDetails.toJSON(), userType: 'student' };
                } else if (msg.receiverType === 'teacher') {
                    otherUserDetails = await Teacher.findByPk(msg.receiverId, {
                        attributes: ['id', 'firstName', 'lastName', 'username', 'imageUrl'],
                    });
                    otherUserDetails = { ...otherUserDetails.toJSON(), userType: 'teacher' };
                } else if (msg.receiverType === 'admin') {
                    otherUserDetails = await Admin.findByPk(msg.receiverId, {
                        attributes: ['name', 'username'],
                    });
                    otherUserDetails = { ...otherUserDetails, userType: 'admin' };
                }
            } else {
                // If the user is the receiver, get the sender's details
                if (msg.senderType === 'student') {
                    otherUserDetails = await Student.findByPk(msg.senderId, {
                        attributes: ['id', 'firstName', 'lastName', 'username', 'profileImg'],
                    });
                    otherUserDetails = { ...otherUserDetails.toJSON(), userType: 'student' };
                } else if (msg.senderType === 'teacher') {
                    otherUserDetails = await Teacher.findByPk(msg.senderId, {
                        attributes: ['id', 'firstName', 'lastName', 'username', 'imageUrl'],
                    });
                    otherUserDetails = { ...otherUserDetails.toJSON(), userType: 'teacher' };
                } else if (msg.senderType === 'admin') {
                    otherUserDetails = await Admin.findByPk(msg.senderId, {
                        attributes: ['name', 'username'],
                    });
                    otherUserDetails = { ...otherUserDetails, userType: 'admin' };
                }
            }
    
            return {
                ...msg,
                otherUserDetails
            };
        })
    );
    console.log("final response",finalResponse);
    res.status(200).json(finalResponse);
    } catch (error) {
      console.error('Error fetching recent chats:', error);
      res.status(500).json({ error: 'Failed to fetch recent chats' });
    }
  });


module.exports = router;
