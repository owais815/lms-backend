const cron = require('node-cron');
const { Op } = require('sequelize');
const Salary = require('../models/Salary');

/**
 * Daily cron at 00:10.
 * Marks unpaid/partial salaries whose dueDate has passed as 'overdue'.
 */
function startOverdueSalariesCron() {
    cron.schedule('10 0 * * *', async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

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
            }
        } catch (error) {
            console.error('[markOverdueSalaries] Error:', error);
        }
    });

    console.log('[markOverdueSalaries] Overdue salaries cron started (runs daily at 00:10).');
}

module.exports = { startOverdueSalariesCron };
