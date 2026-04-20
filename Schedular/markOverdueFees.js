const cron = require('node-cron');
const { Op } = require('sequelize');
const Fee = require('../models/Fee');
const notifyAdmins = require('../utils/notifyAdmins');

/**
 * Start the daily overdue-fees cron job.
 * Schedule: daily at 00:05
 * Logic: UPDATE Fees SET status='overdue' WHERE status='pending' AND dueDate < TODAY
 */
function startOverdueFeesCron() {
    cron.schedule('5 0 * * *', async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const [count] = await Fee.update(
                { status: 'overdue' },
                {
                    where: {
                        status: 'pending',
                        dueDate: { [Op.lt]: today },
                    },
                }
            );

            if (count > 0) {
                console.log(`[markOverdueFees] Marked ${count} fee(s) as overdue.`);
                await notifyAdmins({
                    title: 'Fees Gone Overdue',
                    message: `${count} student fee${count > 1 ? 's have' : ' has'} passed their due date and been marked overdue. Review the Fees section.`,
                    priority: 'warning',
                });
            }
        } catch (error) {
            console.error('[markOverdueFees] Error during overdue check:', error);
        }
    });

    console.log('[markOverdueFees] Overdue fees cron started (runs daily at 00:05).');
}

module.exports = { startOverdueFeesCron };
