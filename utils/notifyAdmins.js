const Admin = require('../models/Admin');
const Role = require('../models/Roles');
const notify = require('./notify');

/**
 * Notify all admins (or only SUPER_ADMINs) with a single call.
 * @param {{ title: string, message: string, priority?: 'critical'|'warning'|'info', superAdminOnly?: boolean }} opts
 */
const notifyAdmins = async ({ title, message, priority = 'info', superAdminOnly = false }) => {
  try {
    // superAdminOnly previously filtered on Admin.userType, a column that does
    // not exist on this model — every call passing it threw, and the throw was
    // swallowed by the catch below, so super admins silently received nothing.
    // The role lives on Roles.role, reached through Admin.roleId, which is the
    // same source middleware/check-permission.js trusts.
    const query = superAdminOnly
      ? {
          attributes: ['id'],
          include: [{ model: Role, attributes: [], where: { role: 'SUPER_ADMIN' }, required: true }],
        }
      : { attributes: ['id'] };

    const admins = await Admin.findAll(query);
    await Promise.all(
      admins.map((a) => notify({ userId: a.id, userType: 'admin', title, message, priority }))
    );
  } catch (err) {
    console.error('[notifyAdmins] error:', err.message);
  }
};

module.exports = notifyAdmins;
