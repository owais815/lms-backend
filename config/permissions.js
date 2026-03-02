/**
 * RBAC Permission Constants
 * Format: resource:action
 * Stored as-is in RolesRights.rights column.
 * ADMIN / SUPER_ADMIN roles bypass all permission checks.
 */

const PERMISSIONS = {
  // Students
  STUDENTS_VIEW:   'students:view',
  STUDENTS_CREATE: 'students:create',
  STUDENTS_EDIT:   'students:edit',
  STUDENTS_DELETE: 'students:delete',

  // Teachers
  TEACHERS_VIEW:   'teachers:view',
  TEACHERS_CREATE: 'teachers:create',
  TEACHERS_EDIT:   'teachers:edit',
  TEACHERS_DELETE: 'teachers:delete',

  // Parents
  PARENTS_VIEW:    'parents:view',
  PARENTS_CREATE:  'parents:create',
  PARENTS_EDIT:    'parents:edit',
  PARENTS_DELETE:  'parents:delete',

  // Courses
  COURSES_VIEW:    'courses:view',
  COURSES_CREATE:  'courses:create',
  COURSES_EDIT:    'courses:edit',
  COURSES_DELETE:  'courses:delete',

  // Classes
  CLASSES_VIEW:    'classes:view',
  CLASSES_MANAGE:  'classes:manage',

  // Class Schedule
  SCHEDULE_VIEW:   'schedule:view',
  SCHEDULE_MANAGE: 'schedule:manage',

  // Attendance
  ATTENDANCE_VIEW: 'attendance:view',
  ATTENDANCE_MARK: 'attendance:mark',

  // Assignments
  ASSIGNMENTS_VIEW:    'assignments:view',
  ASSIGNMENTS_APPROVE: 'assignments:approve',

  // Quizzes
  QUIZZES_VIEW:    'quizzes:view',
  QUIZZES_APPROVE: 'quizzes:approve',

  // Finance
  FINANCE_VIEW:    'finance:view',
  FINANCE_MANAGE:  'finance:manage',

  // Chat
  CHAT_VIEW:       'chat:view',

  // Announcements
  ANNOUNCEMENTS_VIEW:   'announcements:view',
  ANNOUNCEMENTS_CREATE: 'announcements:create',
  ANNOUNCEMENTS_DELETE: 'announcements:delete',

  // Reports
  REPORTS_VIEW:    'reports:view',

  // Roles & Permissions Management (admin-level)
  ROLES_VIEW:      'roles:view',
  ROLES_MANAGE:    'roles:manage',
};

// Roles that bypass all permission checks
const FULL_ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

module.exports = { PERMISSIONS, FULL_ADMIN_ROLES };
