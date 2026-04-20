const Admin = require('../models/Admin');
const notify = require('./notify');

/**
 * Notify all admins (or only SUPER_ADMINs) with a single call.
 * @param {{ title: string, message: string, priority?: 'critical'|'warning'|'info', superAdminOnly?: boolean }} opts
 */
const notifyAdmins = async ({ title, message, priority = 'info', superAdminOnly = false }) => {
  try {
    const where = superAdminOnly ? { userType: 'SUPER_ADMIN' } : {};
    const admins = await Admin.findAll({ where, attributes: ['id'] });
    await Promise.all(
      admins.map((a) => notify({ userId: a.id, userType: 'admin', title, message, priority }))
    );
  } catch (err) {
    console.error('[notifyAdmins] error:', err.message);
  }
};

module.exports = notifyAdmins;
