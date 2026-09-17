const { Op } = require('sequelize');
const Student = require('../models/Student');
const CourseDetails = require('../models/CourseDetails');
const ClassSession = require('../models/ClassSession');
const ClassSessionStudent = require('../models/ClassSessionStudent');
const notify = require('./notify');
const notifyBulk = require('./notifyBulk');

/**
 * Fire the email leg of a notification, if one was requested.
 *
 * Lazily required: this module is pulled in by controllers, and reaching the
 * email subsystem at require time would create a cycle through
 * models/association.js. The codebase already uses lazy requires for exactly
 * this reason (see middleware/rateLimiter.js).
 *
 * Never awaited by the caller's critical path and never allowed to throw -- an
 * email problem must not stop an in-app notification being written.
 *
 * @param {string|undefined} emailEvent registry key
 * @param {object} emailContext entity bag for the template
 * @param {object} emailOptions { transaction, dedupBucket, occurredAt, runAt }
 */
const fireEmail = async (emailEvent, emailContext, emailOptions) => {
  if (!emailEvent) return;
  try {
    const { sendEmailEvent } = require('../emails');
    await sendEmailEvent(emailEvent, emailContext || {}, emailOptions || {});
  } catch (err) {
    console.error('notifyAudience email leg error:', err.message);
  }
};

const STUDENT_ATTRS = ['id', 'firstName', 'lastName', 'parentId'];

/**
 * Build a display name without ever rendering "null" or "undefined".
 * Student.lastName is nullable, so `${firstName} ${lastName}` is not safe.
 *
 * @param {{ firstName?: string, lastName?: string, name?: string }|null|undefined} person
 * @param {string} fallback used when the person is missing or has no usable name
 * @returns {string}
 */
const displayName = (person, fallback = 'A user') => {
  if (!person) return fallback;
  if (person.name) return String(person.name).trim() || fallback;
  const full = `${person.firstName || ''} ${person.lastName || ''}`.trim();
  return full || fallback;
};

/**
 * Every student attached to a class session, and their parents.
 *
 * Sessions link to students two different ways, so precedence matters:
 *   1. ClassSessionStudents junction rows — how generateSessions() assigns students
 *   2. the legacy scalar ClassSession.studentId, for rows predating the junction
 *   3. course enrolment (CourseDetails on courseId + teacherId) for group sessions
 *
 * Without step 2 a legacy row falls through to step 3 and notifies the whole course.
 *
 * @param {object|number} sessionOrId a ClassSession instance or its id
 * @returns {Promise<{ students: Array, studentIds: number[], parentIds: number[], teacherId: number|null, session: object|null }>}
 */
const resolveSessionAudience = async (sessionOrId) => {
  const empty = { students: [], studentIds: [], parentIds: [], teacherId: null, session: null };
  try {
    const session =
      typeof sessionOrId === 'object' && sessionOrId !== null
        ? sessionOrId
        : await ClassSession.findByPk(sessionOrId);
    if (!session) return empty;

    let students = [];

    // 1 — assigned students (personal sessions)
    const links = await ClassSessionStudent.findAll({
      where: { sessionId: session.id },
      attributes: ['studentId'],
    });
    if (links.length > 0) {
      students = await Student.findAll({
        where: { id: links.map((l) => l.studentId) },
        attributes: STUDENT_ATTRS,
      });
    }

    // 2 — legacy scalar link
    if (students.length === 0 && session.studentId) {
      const one = await Student.findByPk(session.studentId, { attributes: STUDENT_ATTRS });
      if (one) students = [one];
    }

    // 3 — course enrolment (group sessions)
    if (students.length === 0 && session.courseId) {
      const where = { courseId: session.courseId };
      if (session.teacherId) where.teacherId = session.teacherId;
      const enrolments = await CourseDetails.findAll({
        where,
        include: [{ model: Student, attributes: STUDENT_ATTRS }],
      });
      students = enrolments.map((cd) => cd.Student).filter(Boolean);
    }

    // The junction has a unique index, but step 3 can repeat a student across
    // enrolment rows, so de-dupe before anything counts these.
    const byId = new Map();
    students.forEach((s) => { if (s && !byId.has(s.id)) byId.set(s.id, s); });
    const unique = [...byId.values()];

    return {
      students: unique,
      studentIds: unique.map((s) => s.id),
      parentIds: [...new Set(unique.map((s) => s.parentId).filter(Boolean))],
      teacherId: session.teacherId || null,
      session,
    };
  } catch (err) {
    console.error('resolveSessionAudience error:', err);
    return empty;
  }
};

/**
 * The inverse of resolveSessionAudience: every session a student belongs to.
 *
 * Querying ClassSession.studentId alone misses everything, because generateSessions()
 * hard-codes that column to null and links students through the junction instead.
 *
 * @param {number} studentId
 * @param {object} [extraWhere] merged into the ClassSession where clause, e.g. { status: 'scheduled' }
 * @param {object} [options] passed through to findAll (include, order, attributes)
 * @returns {Promise<Array>} ClassSession rows
 */
const findSessionsForStudent = async (studentId, extraWhere = {}, options = {}) => {
  try {
    if (!studentId) return [];

    const links = await ClassSessionStudent.findAll({
      where: { studentId },
      attributes: ['sessionId'],
    });
    const sessionIds = links.map((l) => l.sessionId);

    // Group sessions reach the student only through course enrolment.
    const enrolments = await CourseDetails.findAll({
      where: { studentId },
      attributes: ['courseId', 'teacherId'],
    });

    const or = [{ studentId }];
    if (sessionIds.length > 0) or.push({ id: sessionIds });
    enrolments.forEach((cd) => {
      if (!cd.courseId) return;
      const clause = { courseId: cd.courseId };
      if (cd.teacherId) clause.teacherId = cd.teacherId;
      or.push(clause);
    });

    return await ClassSession.findAll({
      ...options,
      where: { ...extraWhere, [Op.or]: or },
    });
  } catch (err) {
    console.error('findSessionsForStudent error:', err);
    return [];
  }
};

/**
 * Notify one student and, if they have one on file, their parent.
 *
 * parentMessage defaults to message; pass it when the parent needs different
 * wording, e.g. "your child's class" rather than "your class".
 *
 * @param {{ studentId: number, title: string, message: string, parentMessage?: string, priority?: string }} opts
 */
const notifyStudentAndParent = async ({
  studentId, title, message, parentMessage, priority = 'info',
  emailEvent, emailContext, emailOptions,
}) => {
  try {
    if (!studentId) return;
    const student = await Student.findByPk(studentId, { attributes: ['id', 'parentId'] });
    if (!student) return;
    await notify({ userId: student.id, userType: 'student', title, message, priority });
    if (student.parentId) {
      await notify({
        userId: student.parentId,
        userType: 'parent',
        title,
        message: parentMessage || message,
        priority,
      });
    }
    // The email leg resolves its own recipients from the registry's audiences,
    // so it reaches the parent even when the in-app notification did not.
    await fireEmail(emailEvent, { studentId, ...(emailContext || {}) }, emailOptions);
  } catch (err) {
    console.error('notifyStudentAndParent error:', err);
  }
};

/**
 * Notify many students and their parents in one pass — one SELECT, not 2N.
 *
 * Pass `students` when the caller already loaded them (rows must include parentId)
 * to skip the lookup.
 *
 * @param {{ studentIds?: number[], students?: Array, title: string, message: string, parentMessage?: string, priority?: string }} opts
 */
const notifyStudentsAndParents = async ({
  studentIds, students, title, message, parentMessage, priority = 'info',
  emailEvent, emailContext, emailOptions,
}) => {
  try {
    let list = students;
    if (!list) {
      const ids = [...new Set((studentIds || []).filter(Boolean))];
      if (ids.length === 0) return;
      list = await Student.findAll({ where: { id: ids }, attributes: STUDENT_ATTRS });
    }
    if (!list || list.length === 0) return;

    const rows = [];
    list.forEach((s) => {
      if (!s || !s.id) return;
      rows.push({ userId: s.id, userType: 'student', title, message, priority });
      // A student with no parent on file must not produce a row.
      if (s.parentId) {
        rows.push({
          userId: s.parentId,
          userType: 'parent',
          title,
          message: parentMessage || message,
          priority,
        });
      }
    });

    await notifyBulk(rows);

    await fireEmail(
      emailEvent,
      { students: list, studentIds: list.map((s) => s.id), ...(emailContext || {}) },
      emailOptions
    );
  } catch (err) {
    console.error('notifyStudentsAndParents error:', err);
  }
};

/**
 * Notify everyone attached to a session, resolving the audience for you.
 *
 * @param {{ session: object|number, title: string, message: string, parentMessage?: string,
 *           teacherMessage?: string, priority?: string, includeParents?: boolean,
 *           includeTeacher?: boolean }} opts
 */
const notifySessionAudience = async ({
  session,
  title,
  message,
  parentMessage,
  teacherMessage,
  priority = 'info',
  includeParents = true,
  includeTeacher = false,
  emailEvent,
  emailContext,
  emailOptions,
}) => {
  try {
    const audience = await resolveSessionAudience(session);

    const rows = audience.students.map((s) => ({
      userId: s.id, userType: 'student', title, message, priority,
    }));

    if (includeParents) {
      audience.parentIds.forEach((pid) => {
        rows.push({
          userId: pid, userType: 'parent', title, message: parentMessage || message, priority,
        });
      });
    }

    if (includeTeacher && audience.teacherId) {
      rows.push({
        userId: audience.teacherId,
        userType: 'teacher',
        title,
        message: teacherMessage || message,
        priority,
      });
    }

    await notifyBulk(rows);

    await fireEmail(
      emailEvent,
      {
        session: audience.session,
        students: audience.students,
        studentIds: audience.studentIds,
        teacherId: audience.teacherId,
        ...(emailContext || {}),
      },
      emailOptions
    );

    return audience;
  } catch (err) {
    console.error('notifySessionAudience error:', err);
    return undefined;
  }
};

module.exports = {
  displayName,
  resolveSessionAudience,
  findSessionsForStudent,
  notifyStudentAndParent,
  notifyStudentsAndParents,
  notifySessionAudience,
};
