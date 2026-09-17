const cron = require('node-cron');
const { Op } = require('sequelize');
const Fee = require('../models/Fee');
const Student = require('../models/Student');
const notify = require('../utils/notify');
const notifyAdmins = require('../utils/notifyAdmins');
const { notifyStudentsAndParents } = require('../utils/notifyAudience');

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

            const noProofFees = overdueFees.filter((fee) => fee.proofStatus === 'none');
            if (noProofFees.length > 0) {
                await notifyAdmins({
                    title: 'Payment Proof Missing',
                    message: `${noProofFees.length} overdue fee${noProofFees.length > 1 ? 's have' : ' has'} no payment proof submitted yet — consider sending a reminder.`,
                    priority: 'warning',
                });
            }

            // One notification per fee — a student with several overdue fees
            // should hear about each of them by name.
            for (const fee of overdueFees) {
                if (!fee.Student) continue;
                await notifyStudentsAndParents({
                    students: [fee.Student],
                    title: 'Fee Overdue',
                    message: `Your fee "${fee.title}" is now overdue.`,
                    parentMessage: `The fee "${fee.title}" is now overdue.`,
                    priority: 'warning',
                    emailEvent: 'fee.overdue',
                    emailContext: { fee, student: fee.Student },
                    // occurredAt is the DUE date, not now: without it, the
                    // first live run of this cron would email every fee that
                    // has ever gone overdue. The go-live guard compares
                    // against this.
                    emailOptions: { occurredAt: fee.dueDate },
                });
            }
        } catch (error) {
            console.error('[markOverdueFees] Error during overdue check:', error);
        }
    });

    console.log('[markOverdueFees] Overdue fees cron started (runs daily at 00:05).');
}

module.exports = { startOverdueFeesCron };
