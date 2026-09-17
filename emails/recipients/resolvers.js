'use strict';

/**
 * Per-audience "entity -> people" lookups.
 *
 * Each resolver takes the dispatch context (whatever entity the caller passed)
 * and returns raw recipient candidates. Validation, dedup and suppression are
 * applied afterwards by ./index.js, so resolvers stay simple and can
 * over-produce without harm.
 *
 * All queries use explicit `attributes` projections and a single include tree,
 * so a fan-out event costs one query per audience rather than one per person.
 */

const { Op } = require('sequelize');

// Lazily required: this module is pulled in from controllers, and going
// through models/association.js at require time would create a cycle. The
// codebase already uses this pattern (see middleware/rateLimiter.js).
const M = () => ({
    Student: require('../../models/Student'),
    Parent: require('../../models/Parent'),
    Teacher: require('../../models/Teacher'),
    Admin: require('../../models/Admin'),
    CourseDetails: require('../../models/CourseDetails'),
});

const fullName = (u) => [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username || '';

const asRecipient = (role) => (u) => ({
    email: u.email,
    name: role === 'admin' ? (u.name || u.username || '') : fullName(u),
    role,
    userId: u.id,
    timeZone: u.timeZone || null,
    source: 'db',
});

/**
 * Pull student ids out of whatever entity the caller provided.
 * Returns [] when the context has nothing student-shaped, which is correct —
 * an event that declares a 'student' audience but is fired without a student
 * simply resolves to nobody rather than throwing inside a request handler.
 */
function studentIdsFromContext(ctx) {
    const ids = new Set();
    const push = (v) => { const n = Number(v); if (Number.isFinite(n) && n > 0) ids.add(n); };

    if (ctx.student) push(ctx.student.id);
    if (ctx.students) for (const s of ctx.students) push(s && s.id);
    if (ctx.studentId) push(ctx.studentId);
    if (ctx.fee) push(ctx.fee.studentId);
    if (ctx.payment) push(ctx.payment.studentId);
    if (ctx.session) push(ctx.session.studentId);
    if (ctx.certificate) push(ctx.certificate.studentId);
    if (ctx.request) push(ctx.request.studentId);
    if (ctx.makeup) push(ctx.makeup.studentId);
    if (ctx.attendance) push(ctx.attendance.studentId);
    if (ctx.user && ctx.userRole === 'student') push(ctx.user.id);

    return [...ids];
}

function teacherIdsFromContext(ctx) {
    const ids = new Set();
    const push = (v) => { const n = Number(v); if (Number.isFinite(n) && n > 0) ids.add(n); };

    if (ctx.teacher) push(ctx.teacher.id);
    if (ctx.teachers) for (const t of ctx.teachers) push(t && t.id);
    if (ctx.teacherId) push(ctx.teacherId);
    if (ctx.session) push(ctx.session.teacherId);
    if (ctx.salary) push(ctx.salary.teacherId);
    if (ctx.assignment) push(ctx.assignment.teacherId);
    if (ctx.quiz) push(ctx.quiz.teacherId);
    if (ctx.makeup) push(ctx.makeup.teacherId);
    if (ctx.schedule) push(ctx.schedule.teacherId);
    if (ctx.leave) push(ctx.leave.teacherId);
    if (ctx.user && ctx.userRole === 'teacher') push(ctx.user.id);

    return [...ids];
}

/** Students directly, or everyone enrolled in a course when given a course. */
async function resolveStudents(ctx) {
    const { Student, CourseDetails } = M();
    let ids = studentIdsFromContext(ctx);

    // Course-wide events (a published assignment, shared content) name a course
    // rather than a student.
    if (ids.length === 0 && (ctx.courseId || (ctx.course && ctx.course.id))) {
        const where = { courseId: ctx.courseId || ctx.course.id };
        if (ctx.teacherId || (ctx.teacher && ctx.teacher.id)) {
            where.teacherId = ctx.teacherId || ctx.teacher.id;
        }
        const rows = await CourseDetails.findAll({ where, attributes: ['studentId'] });
        ids = [...new Set(rows.map((r) => r.studentId).filter(Boolean))];
    }

    if (ids.length === 0) return [];

    const students = await Student.findAll({
        where: { id: { [Op.in]: ids } },
        attributes: ['id', 'firstName', 'lastName', 'username', 'email', 'timeZone'],
    });
    return students.map(asRecipient('student'));
}

/** Parents of whichever students the context resolves to. */
async function resolveParents(ctx) {
    const { Student, Parent } = M();

    let parentIds = [];
    if (ctx.parent && ctx.parent.id) {
        parentIds = [ctx.parent.id];
    } else if (ctx.parentId) {
        parentIds = [ctx.parentId];
    } else if (ctx.user && ctx.userRole === 'parent') {
        parentIds = [ctx.user.id];
    } else {
        const studentIds = studentIdsFromContext(ctx);
        if (studentIds.length === 0) return [];
        const students = await Student.findAll({
            where: { id: { [Op.in]: studentIds } },
            attributes: ['parentId'],
        });
        parentIds = [...new Set(students.map((s) => s.parentId).filter(Boolean))];
    }

    if (parentIds.length === 0) return [];

    const parents = await Parent.findAll({
        where: { id: { [Op.in]: parentIds } },
        attributes: ['id', 'firstName', 'lastName', 'username', 'email', 'timeZone'],
    });
    return parents.map(asRecipient('parent'));
}

async function resolveTeachers(ctx) {
    const { Teacher } = M();
    const ids = teacherIdsFromContext(ctx);
    if (ids.length === 0) return [];

    const teachers = await Teacher.findAll({
        where: { id: { [Op.in]: ids } },
        attributes: ['id', 'firstName', 'lastName', 'username', 'email', 'timeZone'],
    });
    return teachers.map(asRecipient('teacher'));
}

/**
 * Admins from the database, then any addresses configured in settings.
 *
 * Order matters: DB records come first so that dedupeRecipients() keeps them
 * over an env-sourced duplicate of the same address.
 *
 * @param {Object} ctx
 * @param {string[]} fallbackEmails from global.adminAlertEmails
 */
async function resolveAdmins(ctx, fallbackEmails = []) {
    const { Admin } = M();

    const admins = await Admin.findAll({
        where: { email: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } },
        attributes: ['id', 'name', 'username', 'email'],
    });

    const fromDb = admins.map(asRecipient('admin'));

    const fromEnv = (fallbackEmails || []).map((email) => ({
        email,
        name: '',
        role: 'admin',
        // No user id: there is no Admin row behind these, so nothing to link
        // an in-app notification to.
        userId: null,
        timeZone: null,
        source: 'env',
    }));

    return [...fromDb, ...fromEnv];
}

module.exports = {
    resolveStudents,
    resolveParents,
    resolveTeachers,
    resolveAdmins,
    studentIdsFromContext,
    teacherIdsFromContext,
};
