const Admin = require('../models/Admin');
const Role = require('../models/Roles');
const RolesRights = require('../models/RolesRights');
const { FULL_ADMIN_ROLES } = require('../config/permissions');

/**
 * Permission-checking middleware factory.
 * Must be called AFTER isAuth middleware.
 *
 * Usage:
 *   router.get('/route', isAuth, checkPermission('students:view'), controller.fn);
 *
 * Logic:
 *  1. Only allows ADMIN-type users (non-admins get 403 immediately)
 *  2. ADMIN / SUPER_ADMIN roles bypass all permission checks
 *  3. All other admin roles must have the required permission in RolesRights
 */
const checkPermission = (requiredPermission) => async (req, res, next) => {
  try {
    // Only admin-type users may call admin-guarded routes
    if (req.userType !== 'ADMIN') {
      return res.status(403).json({ message: 'Access denied: admin access required.' });
    }

    // Fetch the admin record with its role
    const admin = await Admin.findByPk(req.userId, {
      include: [{ model: Role }],
    });

    if (!admin) {
      return res.status(401).json({ message: 'Admin account not found.' });
    }

    const roleName = admin.Role ? admin.Role.role : null;

    // ADMIN / SUPER_ADMIN bypass all checks
    if (roleName && FULL_ADMIN_ROLES.includes(roleName)) {
      return next();
    }

    // Sub-admin: check if their role has the required permission
    const roleId = admin.roleId || req.roleId;
    if (!roleId) {
      return res.status(403).json({ message: 'Access denied: no role assigned.' });
    }

    const found = await RolesRights.findOne({
      where: { roleId, rights: requiredPermission },
    });

    if (!found) {
      return res.status(403).json({
        message: `Access denied: missing permission '${requiredPermission}'.`,
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = checkPermission;
