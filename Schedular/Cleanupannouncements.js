// cleanupAnnouncements.js
const cron = require('node-cron');
const { Op } = require('sequelize');
const Announcements = require('../models/Announcements');


const cleanupAnnouncements = () => {
  cron.schedule('0 0 * * *', async () => {
    try {
      const now = new Date();

      // Delete announcements where expirationDate is in the past
      await Announcements.destroy({
        where: {
          expirationDate: {
            [Op.lt]: now,
          },
        },
      });

      console.log('Expired announcements cleaned up successfully');
    } catch (error) {
      console.error('Error during cleanup of expired announcements:', error);
    }
  });
};

module.exports = cleanupAnnouncements;
