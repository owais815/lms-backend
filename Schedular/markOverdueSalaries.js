const cron = require('node-cron');
const { Op } = require('sequelize');
const Salary = require('../models/Salary');
const notifyAdmins = require('../utils/notifyAdmins');
const { sendEmailEvent } = require('../emails');
const notify = require('../utils/notify');

/**
 * Daily cron at 00:10.
 * Marks unpaid/partial salaries whose dueDate has passed as 'overdue'.
 */
function startOverdueSalariesCron() {
    cron.schedule('10 0 * * *', async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const goingOverdue = await Salary.findAll({
                where: {
                    status: { [Op.in]: ['unpaid', 'partial'] },
                    dueDate: { [Op.lt]: today },
                },
                attributes: ['id', 'teacherId', 'amount', 'month'],
            });

            const [count] = await Salary.update(
                { status: 'overdue' },
                {
                    where: {
                        status: { [Op.in]: ['unpaid', 'partial'] },
                        dueDate: { [Op.lt]: today },
                    },
                }
            );

            if (count > 0) {
                console.log(`[markOverdueSalaries] Marked ${count} salary record(s) as overdue.`);
                await notifyAdmins({
                    title: 'Salaries Gone Overdue',
                    message: `${count} teacher salary payment${count > 1 ? 's have' : ' has'} passed their due date and been marked overdue. Review the Salary section.`,
                    priority: 'warning',
                });
                sendEmailEvent(
                    'salary.overdue_admin',
                    { count, salaries: goingOverdue.map((s) => s.get({ plain: true })) },
                    { occurredAt: new Date() }
                );

                for (const salary of goingOverdue) {
                    if (!salary.teacherId) continue;
                    await notify({
                        userId: salary.teacherId,
                        userType: 'teacher',
                        title: 'Salary Overdue',
                        message: `Your salary of ${salary.amount} for ${salary.month} is past its due date.`,
                        priority: 'warning',
                    });
                    sendEmailEvent(
                        'salary.overdue_teacher',
                        { salary, teacherId: salary.teacherId },
                        { occurredAt: salary.dueDate }
                    );
                }
            }
        } catch (error) {
            console.error('[markOverdueSalaries] Error:', error);
        }
    });

    console.log('[markOverdueSalaries] Overdue salaries cron started (runs daily at 00:10).');
}

module.exports = { startOverdueSalariesCron };
