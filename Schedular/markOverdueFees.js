const cron = require('node-cron');
const { Op } = require('sequelize');
const Fee = require('../models/Fee');
const Student = require('../models/Student');
const notify = require('../utils/notify');
const notifyAdmins = require('../utils/notifyAdmins');

/**
 * Start the daily overdue-fees cron job.
 * Schedule: daily at 00:05
 * Logic: mark pending fees past their due date as overdue, notify the admin
 * team once with a count, and notify each affected student + parent individually.
 */
function startOverdueFeesCron() {
    cron.schedule('5 0 * * *', async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const overdueFees = await Fee.findAll({
                where: { status: 'pending', dueDate: { [Op.lt]: today } },
                include: [{ model: Student, attributes: ['id', 'parentId'] }],
            });

            if (overdueFees.length === 0) return;

            await Fee.update(
                { status: 'overdue' },
                { where: { id: overdueFees.map((f) => f.id) } }
            );

            console.log(`[markOverdueFees] Marked ${overdueFees.length} fee(s) as overdue.`);

            await notifyAdmins({
                title: 'Fees Gone Overdue',
                message: `${overdueFees.length} student fee${overdueFees.length > 1 ? 's have' : ' has'} passed their due date and been marked overdue. Review the Fees section.`,
                priority: 'warning',
            });

            await Promise.all(
                overdueFees.map(async (fee) => {
                    if (!fee.Student) return;
                    const msg = `Your fee "${fee.title}" is now overdue.`;
                    await notify({ userId: fee.Student.id, userType: 'student', title: 'Fee Overdue', message: msg, priority: 'warning' });
                    if (fee.Student.parentId) {
                        await notify({ userId: fee.Student.parentId, userType: 'parent', title: 'Fee Overdue', message: msg, priority: 'warning' });
                    }
                })
            );
        } catch (error) {
            console.error('[markOverdueFees] Error during overdue check:', error);
        }
    });

    console.log('[markOverdueFees] Overdue fees cron started (runs daily at 00:05).');
}

module.exports = { startOverdueFeesCron };
