const cron = require('node-cron');
const Fee = require('../models/Fee');
const AutoPayMethod = require('../models/AutoPayMethod');
const Student = require('../models/Student');
const notify = require('../utils/notify');
const { attemptCharge, deactivateAutoPay } = require('../controllers/autoPay');

/**
 * Start the daily auto-pay cron job.
 * Schedule: daily at 00:15 (after markOverdueFees has run at 00:05).
 *
 * For students with an active card on file:
 *  - a fee due today gets a charge attempt (stubbed — see attemptCharge)
 *  - a fee already overdue means the retry chain has failed repeatedly,
 *    so the card on file is deactivated and everyone is notified.
 */
function startAutoChargeFeesCron() {
    cron.schedule('15 0 * * *', async () => {
        try {
            const today = new Date().toISOString().split('T')[0];

            const dueToday = await Fee.findAll({
                where: { status: 'pending', dueDate: today },
                include: [{ model: Student, attributes: ['id'], include: [{ model: AutoPayMethod, where: { status: 'active' }, required: true }] }],
            });

            for (const fee of dueToday) {
                const method = fee.Student.AutoPayMethods?.[0];
                if (!method) continue;
                const result = await attemptCharge(fee, method);
                if (!result.ok) {
                    await notify({
                        userId: fee.studentId,
                        userType: 'student',
                        title: 'Auto-Pay Reminder',
                        message: `We'll retry your card on file for "${fee.title}" — no action needed unless it fails again.`,
                    });
                }
            }

            const overdueWithAutoPay = await Fee.findAll({
                where: { status: 'overdue' },
                include: [{ model: Student, attributes: ['id'], include: [{ model: AutoPayMethod, where: { status: 'active' }, required: true }] }],
            });

            const handledMethodIds = new Set();
            for (const fee of overdueWithAutoPay) {
                const method = fee.Student.AutoPayMethods?.[0];
                if (!method || handledMethodIds.has(method.id)) continue;
                handledMethodIds.add(method.id);
                await deactivateAutoPay(method);
            }
        } catch (error) {
            console.error('[autoChargeFees] Error during auto-charge run:', error);
        }
    });

    console.log('[autoChargeFees] Auto-charge fees cron started (runs daily at 00:15).');
}

module.exports = { startAutoChargeFeesCron };
