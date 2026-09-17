/**
 * Notification smoke test — exercises the notification helpers and reminder crons
 * against a real database, without booting the HTTP server.
 *
 * Usage:
 *   node scripts/notify-smoke.js           run all cases, clean up after
 *   node scripts/notify-smoke.js --keep    leave the created rows for inspection
 *   node scripts/notify-smoke.js --force   allow NODE_ENV=production (don't)
 *
 * It creates its own throwaway students/parents/sessions (all prefixed SMOKE_) and
 * deletes them at the end, along with the notifications addressed to them. Rows
 * belonging to anyone else are never touched.
 *
 * Safe to run against a dev database. It refuses to start with
 * NODE_ENV=production, and its cleanup only ever deletes rows belonging to the
 * fixture users it created.
 */

require('../models/association');
const { Op } = require('sequelize');
const sequelize = require('../utils/database');

const Notification = require('../models/Notifications');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Teacher = require('../models/Teacher');
const Courses = require('../models/Course');
const CourseDetails = require('../models/CourseDetails');
const ClassSession = require('../models/ClassSession');
const ClassSchedule = require('../models/ClassSchedule');
const ClassSessionStudent = require('../models/ClassSessionStudent');
const Announcements = require('../models/Announcements');

const notifyBulk = require('../utils/notifyBulk');
const {
  displayName,
  resolveSessionAudience,
  notifyStudentAndParent,
  notifyStudentsAndParents,
} = require('../utils/notifyAudience');

const KEEP = process.argv.includes('--keep');
const FORCE = process.argv.includes('--force');
const TAG = 'SMOKE';

// This script writes fixture rows and then deletes them. On a database with real
// users that is a bad idea even when the deletes are correctly scoped, so refuse
// outright unless someone insists.
if (process.env.NODE_ENV === 'production' && !FORCE) {
  console.error('Refusing to run with NODE_ENV=production.');
  console.error('Point DB_NAME at a development database, or pass --force if you');
  console.error('genuinely mean to create and delete fixture rows in production.');
  process.exit(2);
}

const results = [];
const created = { students: [], parents: [], teachers: [], courses: [], courseDetails: [], sessions: [], schedules: [], announcements: [] };

// ─── Assertion plumbing ──────────────────────────────────────────────────────

const record = (name, passed, detail) => {
  results.push({ name, passed, detail: detail || '' });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

/** Run `fn`, then return every notification it created. */
const capture = async (fn) => {
  const before = (await Notification.max('id')) || 0;
  await fn();
  return Notification.findAll({
    where: { id: { [Op.gt]: before } },
    order: [['id', 'ASC']],
  });
};

const typesOf = (rows) => rows.map((r) => r.userType).sort().join(',');

// ─── Fixtures ────────────────────────────────────────────────────────────────

async function seed() {
  const parent = await Parent.create({
    firstName: `${TAG}_Parent`, lastName: 'One',
    email: `${TAG.toLowerCase()}.parent@example.test`,
    username: `${TAG.toLowerCase()}.parent`, password: 'x',
  });
  created.parents.push(parent);

  const teacher = await Teacher.create({
    firstName: `${TAG}_Teacher`, lastName: 'One',
    email: `${TAG.toLowerCase()}.teacher@example.test`,
    username: `${TAG.toLowerCase()}.teacher`, password: 'x',
  });
  created.teachers.push(teacher);

  // withParent: has a parent on file. noParent: parentId stays null — the case
  // that must never produce a parent notification row.
  const withParent = await Student.create({
    firstName: `${TAG}_Kid`, lastName: 'WithParent',
    email: `${TAG.toLowerCase()}.kid1@example.test`,
    username: `${TAG.toLowerCase()}.kid1`, password: 'x', parentId: parent.id,
  });
  const noParent = await Student.create({
    firstName: `${TAG}_Kid`, lastName: null,
    email: `${TAG.toLowerCase()}.kid2@example.test`,
    username: `${TAG.toLowerCase()}.kid2`, password: 'x', parentId: null,
  });
  created.students.push(withParent, noParent);

  const course = await Courses.create({ courseName: `${TAG}_Course` });
  created.courses.push(course);

  // Both students enrolled — the group-session audience.
  for (const s of [withParent, noParent]) {
    const cd = await CourseDetails.create({
      studentId: s.id, teacherId: teacher.id, courseId: course.id,
    });
    created.courseDetails.push(cd);
  }

  return { parent, teacher, withParent, noParent, course };
}

async function cleanup() {
  if (KEEP) {
    console.log('\n--keep given: leaving fixtures and notifications in place.');
    return;
  }
  // Scope the delete to the fixture recipients. An id-range delete would also
  // remove notifications real users received while this script was running.
  const fixtureRecipients = [
    ...created.students.map((r) => ({ userType: 'student', userId: r.id })),
    ...created.parents.map((r) => ({ userType: 'parent', userId: r.id })),
    ...created.teachers.map((r) => ({ userType: 'teacher', userId: r.id })),
  ];
  for (const who of fixtureRecipients) {
    await Notification.destroy({ where: who });
  }
  await ClassSessionStudent.destroy({ where: { sessionId: created.sessions.map((s) => s.id) } });
  for (const key of ['sessions', 'schedules', 'announcements', 'courseDetails', 'students', 'courses', 'teachers', 'parents']) {
    for (const row of created[key]) {
      try { await row.destroy(); } catch (e) { /* FK order — best effort */ }
    }
  }
  console.log('\nFixtures and smoke notifications removed.');
}

// ─── Cases ───────────────────────────────────────────────────────────────────

async function run() {
  const fx = await seed();

  // 1 — a student with a parent produces exactly two rows
  {
    const rows = await capture(() => notifyStudentAndParent({
      studentId: fx.withParent.id, title: 'Smoke One', message: 'hello',
    }));
    record('notifyStudentAndParent reaches student + parent',
      rows.length === 2 && typesOf(rows) === 'parent,student',
      `${rows.length} row(s): ${typesOf(rows)}`);
  }

  // 2 — a parentless student must NOT produce a parent row
  {
    const rows = await capture(() => notifyStudentAndParent({
      studentId: fx.noParent.id, title: 'Smoke Two', message: 'hello',
    }));
    record('notifyStudentAndParent skips a null parentId',
      rows.length === 1 && rows[0].userType === 'student',
      `${rows.length} row(s): ${typesOf(rows)}`);
  }

  // 3 — parentMessage reaches the parent, message reaches the student
  {
    const rows = await capture(() => notifyStudentAndParent({
      studentId: fx.withParent.id, title: 'Smoke Three',
      message: 'your class', parentMessage: 'your child class',
    }));
    const student = rows.find((r) => r.userType === 'student');
    const parent = rows.find((r) => r.userType === 'parent');
    record('parentMessage is delivered separately',
      student?.message === 'your class' && parent?.message === 'your child class',
      `student="${student?.message}" parent="${parent?.message}"`);
  }

  // 4 — batch: 2 students, one parentless, one id duplicated → 3 rows, no dupes
  {
    const rows = await capture(() => notifyStudentsAndParents({
      studentIds: [fx.withParent.id, fx.noParent.id, fx.withParent.id],
      title: 'Smoke Four', message: 'batch',
    }));
    record('notifyStudentsAndParents de-dupes and skips null parents',
      rows.length === 3 && typesOf(rows) === 'parent,student,student',
      `${rows.length} row(s): ${typesOf(rows)}`);
  }

  // 5 — notifyBulk drops malformed rows rather than losing the batch
  {
    const rows = await capture(() => notifyBulk([
      { userId: fx.withParent.id, userType: 'student', title: 'Smoke Five', message: 'good' },
      { userId: null, userType: 'parent', title: 'Smoke Five', message: 'bad row' },
      { userId: fx.noParent.id, userType: 'student', title: 'Smoke Five', message: 'good' },
    ]));
    record('notifyBulk survives a malformed row',
      rows.length === 2, `${rows.length} row(s) inserted from 3 (1 invalid)`);
  }

  // 6 — group session: no junction rows, so the audience is the whole enrolment
  {
    const schedule = await ClassSchedule.create({
      title: `${TAG}_Schedule`, recurrenceType: 'one-time',
      startTime: '10:00:00', endTime: '11:00:00',
      startDate: '2030-01-01', status: 'active', createdBy: 'admin',
      courseId: fx.course.id, teacherId: fx.teacher.id,
    });
    created.schedules.push(schedule);

    const group = await ClassSession.create({
      scheduleId: schedule.id, title: `${TAG}_Group`, date: '2030-01-01',
      startTime: '10:00:00', endTime: '11:00:00', status: 'scheduled',
      courseId: fx.course.id, teacherId: fx.teacher.id, studentId: null,
    });
    created.sessions.push(group);

    const audience = await resolveSessionAudience(group);
    record('resolveSessionAudience falls back to course enrolment',
      audience.studentIds.length === 2 && audience.parentIds.length === 1,
      `${audience.studentIds.length} student(s), ${audience.parentIds.length} parent(s)`);

    // 7 — personal session: junction row wins over the enrolment fallback
    const personal = await ClassSession.create({
      scheduleId: schedule.id, title: `${TAG}_Personal`, date: '2030-01-02',
      startTime: '10:00:00', endTime: '11:00:00', status: 'scheduled',
      courseId: fx.course.id, teacherId: fx.teacher.id, studentId: null,
    });
    created.sessions.push(personal);
    await ClassSessionStudent.create({ sessionId: personal.id, studentId: fx.noParent.id });

    const personalAudience = await resolveSessionAudience(personal);
    record('resolveSessionAudience prefers junction-assigned students',
      personalAudience.studentIds.length === 1 && personalAudience.studentIds[0] === fx.noParent.id,
      `${personalAudience.studentIds.length} student(s)`);

    // 8 — legacy scalar studentId resolves to that one student, not the course
    const legacy = await ClassSession.create({
      scheduleId: schedule.id, title: `${TAG}_Legacy`, date: '2030-01-03',
      startTime: '10:00:00', endTime: '11:00:00', status: 'scheduled',
      courseId: fx.course.id, teacherId: fx.teacher.id, studentId: fx.withParent.id,
    });
    created.sessions.push(legacy);
    const legacyAudience = await resolveSessionAudience(legacy);
    record('resolveSessionAudience honours the legacy scalar studentId',
      legacyAudience.studentIds.length === 1 && legacyAudience.studentIds[0] === fx.withParent.id,
      `${legacyAudience.studentIds.length} student(s)`);
  }

  // 9 — null lastName must not render as "null"
  {
    const name = displayName(fx.noParent, 'A student');
    record('displayName is null-safe',
      !name.includes('null') && !name.includes('undefined') && name.length > 0,
      `"${name}"`);
  }

  // 10 — class reminder cron: claims its rows, second run is silent
  {
    const { run: remind } = require('../Schedular/classReminders');
    const soon = new Date(Date.now() + 15 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');

    const schedule = created.schedules[0];
    const session = await ClassSession.create({
      scheduleId: schedule.id, title: `${TAG}_Soon`,
      date: new Date().toISOString().split('T')[0],
      startTime: `${pad(soon.getHours())}:${pad(soon.getMinutes())}:00`,
      endTime: '23:59:00', status: 'scheduled', sessionStatus: 'idle',
      courseId: schedule.courseId, teacherId: schedule.teacherId, studentId: null,
    });
    created.sessions.push(session);

    const first = await capture(() => remind());
    const second = await capture(() => remind());
    record('class reminder cron does not re-send after claiming',
      second.length === 0,
      `first run ${first.length} row(s), second run ${second.length} row(s)`);

    // 11 — a cancelled session is never reminded
    const cancelled = await ClassSession.create({
      scheduleId: schedule.id, title: `${TAG}_Cancelled`,
      date: new Date().toISOString().split('T')[0],
      startTime: `${pad(soon.getHours())}:${pad(soon.getMinutes())}:00`,
      endTime: '23:59:00', status: 'cancelled', sessionStatus: 'idle',
      courseId: schedule.courseId, teacherId: schedule.teacherId, studentId: null,
    });
    created.sessions.push(cancelled);
    await remind();
    await cancelled.reload();
    record('class reminder cron skips cancelled sessions',
      cancelled.reminderSentAt === null,
      `reminderSentAt=${cancelled.reminderSentAt}`);
  }

  // 12 — announcement notifier: delivers once, ignores future-dated rows
  {
    const { run: deliver } = require('../Schedular/announcementNotifier');

    const due = await Announcements.create({
      title: `${TAG}_Due`, message: 'due now',
      scheduledTime: new Date(Date.now() - 60000),
      expirationDate: new Date(Date.now() + 86400000),
      userType: 'student', userId: fx.withParent.id, type: 'general',
    });
    const future = await Announcements.create({
      title: `${TAG}_Future`, message: 'not yet',
      scheduledTime: new Date(Date.now() + 86400000),
      expirationDate: new Date(Date.now() + 172800000),
      userType: 'student', userId: fx.withParent.id, type: 'general',
    });
    created.announcements.push(due, future);

    const first = await capture(() => deliver());
    const second = await capture(() => deliver());
    await future.reload();

    record('announcement notifier delivers due rows exactly once',
      first.length >= 1 && second.length === 0,
      `first ${first.length} row(s), second ${second.length} row(s)`);
    record('announcement notifier leaves future-dated rows alone',
      future.notifiedAt === null,
      `notifiedAt=${future.notifiedAt}`);
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

(async () => {
  let exitCode = 0;
  try {
    await sequelize.authenticate();
    console.log('Connected. Running notification smoke tests...\n');
    await run();
  } catch (err) {
    console.error('\nSmoke run aborted:', err);
    exitCode = 1;
  } finally {
    try { await cleanup(); } catch (e) { console.error('Cleanup failed:', e.message); }

    const failed = results.filter((r) => !r.passed);
    console.log(`\n${results.length - failed.length}/${results.length} passed.`);
    if (failed.length > 0) {
      console.log('Failures:');
      failed.forEach((r) => console.log(`  - ${r.name}: ${r.detail}`));
      exitCode = 1;
    }
    await sequelize.close();
    process.exit(exitCode);
  }
})();
