const { Op } = require('sequelize');
const moment = require('moment-timezone');
const PKT = 'Asia/Karachi';
const ClassSchedule = require('../models/ClassSchedule');
const ClassSession = require('../models/ClassSession');
const ClassSessionStudent = require('../models/ClassSessionStudent');
const Courses = require('../models/Course');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Quiz = require('../models/Quiz/Quiz');
const Assignment = require('../models/Assignment/Assignment');
const CourseDetails = require('../models/CourseDetails');
const Parent = require('../models/Parent');
const Admin = require('../models/Admin');
const Attendance = require('../models/Attendance');
const SessionFeedback = require('../models/SessionFeedback');
const callingAppService = require('../services/callingAppService');
const socket = require('../socket');
const notify = require('../utils/notify');

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------
const SESSION_COLORS = {
  scheduled: '#3B82F6',
  completed: '#6B7280',
  cancelled: '#EF4444',
  makeup: '#8B5CF6',
  pending: '#F59E0B',
  live: '#22C55E',
};

const EVENT_COLORS = {
  quiz: '#10B981',
  assignment: '#F97316',
};

// ---------------------------------------------------------------------------
// Internal: generate ClassSession rows from a ClassSchedule
// ---------------------------------------------------------------------------
// studentIds: number[] — if non-empty, sessions are linked to those students via ClassSessionStudents
//                        if empty, sessions are group sessions (visible to all enrolled)
async function generateSessions(schedule, studentIds = []) {
  const sessions = [];
  const {
    id: scheduleId,
    title,
    recurrenceType,
    daysOfWeek,
    startDate,
    endDate,
    startTime,
    endTime,
    courseId,
    teacherId,
    courseDetailsId,
    shift,
  } = schedule;

  const baseSession = {
    scheduleId,
    title,
    startTime,
    endTime,
    meetingLink: null,
    status: 'scheduled',
    courseId,
    teacherId,
    studentId: null, // always null — student assignment handled by ClassSessionStudents
    courseDetailsId,
    shift: shift || null,
  };

  if (recurrenceType === 'one-time') {
    sessions.push({ ...baseSession, date: startDate });
  } else {
    const days = Array.isArray(daysOfWeek) ? daysOfWeek : [];
    const end = endDate ? new Date(endDate) : (() => {
      const d = new Date(startDate);
      d.setFullYear(d.getFullYear() + 1);
      return d;
    })();

    let current = new Date(startDate);
    let count = 0;
    while (current <= end && count < 500) {
      if (days.includes(current.getDay())) {
        sessions.push({ ...baseSession, date: current.toISOString().slice(0, 10) });
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
  }

  if (sessions.length > 0) {
    const created = await ClassSession.bulkCreate(sessions, { returning: true });

    // Assign room IDs
    await Promise.all(
      created.map((s) => ClassSession.update({ roomId: `lms-${s.id}` }, { where: { id: s.id } }))
    );

    // Link students via junction table if specific students were selected
    if (studentIds.length > 0) {
      const junctionRows = [];
      for (const s of created) {
        for (const sid of studentIds) {
          junctionRows.push({ sessionId: s.id, studentId: Number(sid) });
        }
      }
      await ClassSessionStudent.bulkCreate(junctionRows, { ignoreDuplicates: true });
    }
  }
  return sessions.length;
}

// ---------------------------------------------------------------------------
// POST /api/class-schedule  — Admin creates a schedule
// ---------------------------------------------------------------------------
exports.createSchedule = async (req, res) => {
  try {
    const {
      title, description, recurrenceType, daysOfWeek,
      startTime, endTime, startDate, endDate,
      meetingLink, courseId, teacherId, studentIds, courseDetailsId, shift,
    } = req.body;

    if (!title || !startTime || !endTime || !startDate || !courseId || !teacherId) {
      return res.status(400).json({ message: 'title, startTime, endTime, startDate, courseId, teacherId are required' });
    }
    if ((recurrenceType === 'weekly' || recurrenceType === 'biweekly') && (!daysOfWeek || daysOfWeek.length === 0)) {
      return res.status(400).json({ message: 'daysOfWeek required for weekly/biweekly recurrence' });
    }

    const scheduleBase = {
      title, description,
      recurrenceType: recurrenceType || 'one-time',
      daysOfWeek: daysOfWeek || null,
      startTime, endTime, startDate,
      endDate: endDate || null,
      meetingLink: meetingLink || null,
      status: 'active',
      createdBy: 'admin',
      courseId, teacherId,
      courseDetailsId: courseDetailsId || null,
      shift: shift || null,
    };

    const selectedStudentIds = Array.isArray(studentIds) && studentIds.length > 0
      ? studentIds.map(Number) : [];

    // Always one schedule; student assignment is in ClassSessionStudents junction table
    const schedule = await ClassSchedule.create({ ...scheduleBase, studentId: null });
    const totalSessionCount = await generateSessions(schedule, selectedStudentIds);
    const lastSchedule = schedule;

    return res.status(201).json({
      message: 'Schedule created successfully',
      schedule: lastSchedule,
      sessionCount: totalSessionCount,
    });
  } catch (err) {
    console.error('createSchedule error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/class-schedule/propose  — Teacher proposes a session
// ---------------------------------------------------------------------------
exports.proposeSession = async (req, res) => {
  try {
    const {
      title, startTime, endTime, startDate,
      meetingLink, courseId, teacherId, studentIds, courseDetailsId, shift,
    } = req.body;

    if (!title || !startTime || !endTime || !startDate || !courseId || !teacherId) {
      return res.status(400).json({ message: 'title, startTime, endTime, startDate, courseId, teacherId are required' });
    }

    const selectedStudentIds = Array.isArray(studentIds) && studentIds.length > 0
      ? studentIds.map(Number) : [];

    // One schedule — student assignment via junction table
    const schedule = await ClassSchedule.create({
      title,
      recurrenceType: 'one-time',
      daysOfWeek: null,
      startTime, endTime, startDate,
      endDate: null,
      meetingLink: meetingLink || null,
      status: 'pending',
      createdBy: 'teacher',
      courseId, teacherId,
      studentId: null,
      courseDetailsId: courseDetailsId || null,
      shift: shift || null,
    });

    const proposedSession = await ClassSession.create({
      scheduleId: schedule.id, title, date: startDate, startTime, endTime,
      meetingLink: null, status: 'scheduled', courseId, teacherId,
      studentId: null, courseDetailsId: courseDetailsId || null, shift: shift || null,
    });
    await proposedSession.update({ roomId: `lms-${proposedSession.id}` });

    if (selectedStudentIds.length > 0) {
      await ClassSessionStudent.bulkCreate(
        selectedStudentIds.map((sid) => ({ sessionId: proposedSession.id, studentId: sid })),
        { ignoreDuplicates: true }
      );
    }

    const lastSchedule = schedule;

    // Notify admins of pending proposal
    const admins = await Admin.findAll({ attributes: ['id'] });
    const teacher = await Teacher.findByPk(teacherId, { attributes: ['firstName', 'lastName'] });
    const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : 'A teacher';
    await Promise.all(
      admins.map((admin) =>
        notify({
          userId: admin.id,
          userType: 'admin',
          title: 'Session Proposal',
          message: `${teacherName} proposed a session "${title}" awaiting your approval.`,
        })
      )
    );

    return res.status(201).json({ message: 'Session proposed — awaiting admin approval', schedule: lastSchedule });
  } catch (err) {
    console.error('proposeSession error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/class-schedule/:id/approve  — Admin approves teacher proposal
// ---------------------------------------------------------------------------
exports.approveSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await ClassSchedule.findByPk(id);
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });

    await schedule.update({ status: 'active' });

    // Notify teacher that proposal was approved
    if (schedule.teacherId) {
      notify({
        userId: schedule.teacherId,
        userType: 'teacher',
        title: 'Session Approved',
        message: `Your proposed session "${schedule.title}" has been approved.`,
      });
    }

    return res.json({ message: 'Schedule approved', schedule });
  } catch (err) {
    console.error('approveSchedule error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/class-schedule/:id/cancel  — Admin cancels entire schedule
// ---------------------------------------------------------------------------
exports.cancelSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, cancelledByRole } = req.body;
    const schedule = await ClassSchedule.findByPk(id);
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });

    await schedule.update({ status: 'cancelled' });

    const today = new Date().toISOString().slice(0, 10);

    // Find any sessions that are currently live so we can emit socket events
    const liveSessions = await ClassSession.findAll({
      where: { scheduleId: id, date: { [Op.gte]: today }, status: 'scheduled', sessionStatus: 'live' },
      attributes: ['id'],
    });

    // Cancel all future scheduled sessions; reset sessionStatus for live ones
    await ClassSession.update(
      { status: 'cancelled', cancellationReason: reason || 'Schedule cancelled by admin' },
      { where: { scheduleId: id, date: { [Op.gte]: today }, status: 'scheduled' } }
    );
    if (liveSessions.length > 0) {
      await ClassSession.update(
        { sessionStatus: 'ended' },
        { where: { id: liveSessions.map((s) => s.id) } }
      );

      // Notify connected clients for each live session that was cancelled
      try {
        const ioPromise = socket.getIO();
        if (ioPromise) {
          const io = await ioPromise;
          for (const s of liveSessions) {
            io.to(`session-${s.id}`).emit('session:ended', {
              sessionId: Number(s.id),
              cancelled: true,
              cancelledBy: cancelledByRole === 'teacher' ? 'Teacher' : 'Admin',
              reason: reason || '',
            });
          }
        }
      } catch (socketErr) {
        console.error('Socket emit error (non-fatal):', socketErr.message);
      }
    }

    return res.json({ message: 'Schedule and future sessions cancelled' });
  } catch (err) {
    console.error('cancelSchedule error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/class-schedule/sessions/:sessionId/cancel  — Cancel single session
// ---------------------------------------------------------------------------
exports.cancelSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason, cancelledByRole } = req.body;

    const session = await ClassSession.findByPk(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const wasLive = session.sessionStatus === 'live';

    await session.update({
      status: 'cancelled',
      cancellationReason: reason || 'Cancelled',
      // If the session was live, mark it ended so the DB stays consistent
      // and formatSessionEvent never accidentally shows it green.
      ...(wasLive ? { sessionStatus: 'ended' } : {}),
    });

    // Notify any connected clients so their CallModal closes / live badge clears
    if (wasLive) {
      try {
        const ioPromise = socket.getIO();
        if (ioPromise) {
          const io = await ioPromise;
          io.to(`session-${sessionId}`).emit('session:ended', {
            sessionId: Number(sessionId),
            cancelled: true,
            cancelledBy: cancelledByRole === 'teacher' ? 'Teacher' : 'Admin',
            reason: reason || '',
          });
        }
      } catch (socketErr) {
        console.error('Socket emit error (non-fatal):', socketErr.message);
      }
    }

    // Notify teacher + enrolled students + parents of cancellation
    try {
      const cancelMsg = `The class "${session.title}" on ${session.date} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`;

      // Notify the assigned teacher
      await notify({ userId: session.teacherId, userType: 'TEACHER', title: 'Class Cancelled', message: cancelMsg });

      if (session.courseId && session.teacherId) {
        const enrolledStudents = await CourseDetails.findAll({
          where: { courseId: session.courseId, teacherId: session.teacherId },
          include: [{ model: Student, attributes: ['id', 'parentId'] }],
        });
        await Promise.all(
          enrolledStudents.map(async (cd) => {
            if (!cd.Student) return;
            await notify({ userId: cd.Student.id, userType: 'STUDENT', title: 'Class Cancelled', message: cancelMsg });
            if (cd.Student.parentId) {
              await notify({ userId: cd.Student.parentId, userType: 'PARENT', title: 'Class Cancelled', message: cancelMsg });
            }
          })
        );
      }
    } catch (notifErr) {
      console.error('Notification error (non-fatal):', notifErr.message);
    }

    return res.json({ message: 'Session cancelled', session });
  } catch (err) {
    console.error('cancelSession error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/class-schedule/sessions/:sessionId
// ---------------------------------------------------------------------------
exports.getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await ClassSession.findByPk(sessionId, {
      include: [
        { model: Courses, foreignKey: 'courseId' },
        { model: Teacher, foreignKey: 'teacherId', attributes: ['id', 'firstName', 'lastName', 'imageUrl'] },
        { model: Student, foreignKey: 'studentId', attributes: ['id', 'firstName', 'lastName'] },
        { model: ClassSchedule, as: 'schedule', foreignKey: 'scheduleId' },
      ],
    });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    return res.json(session);
  } catch (err) {
    console.error('getSession error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/class-schedule/admin/all
// ---------------------------------------------------------------------------
exports.getAllSchedules = async (req, res) => {
  try {
    const schedules = await ClassSchedule.findAll({
      include: [
        { model: Courses, foreignKey: 'courseId', attributes: ['id', 'courseName'] },
        { model: Teacher, foreignKey: 'teacherId', attributes: ['id', 'firstName', 'lastName'] },
        { model: Student, foreignKey: 'studentId', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    return res.json(schedules);
  } catch (err) {
    console.error('getAllSchedules error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/class-schedule/admin/pending
// ---------------------------------------------------------------------------
exports.getAdminPendingApprovals = async (req, res) => {
  try {
    const pending = await ClassSchedule.findAll({
      where: { status: 'pending' },
      include: [
        { model: Courses, foreignKey: 'courseId', attributes: ['id', 'courseName'] },
        { model: Teacher, foreignKey: 'teacherId', attributes: ['id', 'firstName', 'lastName'] },
        { model: Student, foreignKey: 'studentId', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    return res.json(pending);
  } catch (err) {
    console.error('getAdminPendingApprovals error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/class-schedule/teacher/:teacherId
// ---------------------------------------------------------------------------
exports.getTeacherSchedules = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const schedules = await ClassSchedule.findAll({
      where: { teacherId },
      include: [
        { model: Courses, foreignKey: 'courseId', attributes: ['id', 'courseName'] },
        { model: Student, foreignKey: 'studentId', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['startDate', 'DESC']],
    });
    return res.json(schedules);
  } catch (err) {
    console.error('getTeacherSchedules error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/class-schedule/student/:studentId
// ---------------------------------------------------------------------------
exports.getStudentSchedules = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Find schedules via sessions that are assigned to this student in the junction table,
    // plus schedules for group sessions (no junction rows) in courses the student is enrolled in.
    const { literal } = require('sequelize');
    const enrolledCourses = await CourseDetails.findAll({
      where: { studentId },
      attributes: ['courseId'],
    });
    const enrolledCourseIds = enrolledCourses.map((cd) => cd.courseId);

    // Get session IDs visible to this student
    const assignedSessionIds = await ClassSessionStudent.findAll({
      where: { studentId },
      attributes: ['sessionId'],
    });
    const assignedIds = assignedSessionIds.map((r) => r.sessionId);

    // Get unique scheduleIds from those sessions + group sessions in enrolled courses
    const { Op: OpLocal } = require('sequelize');
    const visibleSessions = await ClassSession.findAll({
      where: {
        [OpLocal.or]: [
          ...(assignedIds.length > 0 ? [{ id: { [OpLocal.in]: assignedIds } }] : []),
          ...(enrolledCourseIds.length > 0
            ? [{
                courseId: { [OpLocal.in]: enrolledCourseIds },
                [OpLocal.and]: [literal(`(SELECT COUNT(*) FROM ClassSessionStudents WHERE ClassSessionStudents.sessionId = ClassSession.id) = 0`)],
              }]
            : []),
        ],
      },
      attributes: ['scheduleId'],
    });
    const scheduleIds = [...new Set(visibleSessions.map((s) => s.scheduleId).filter(Boolean))];

    if (scheduleIds.length === 0) return res.json([]);

    const schedules = await ClassSchedule.findAll({
      where: { id: scheduleIds, status: 'active' },
      include: [
        { model: Courses, foreignKey: 'courseId', attributes: ['id', 'courseName'] },
        { model: Teacher, foreignKey: 'teacherId', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['startDate', 'ASC']],
    });
    return res.json(schedules);
  } catch (err) {
    console.error('getStudentSchedules error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// Helper: format a ClassSession row into a FullCalendar event object
// ---------------------------------------------------------------------------
// students: array from ClassSessionStudents join. Empty = group session.
function formatSessionEvent(session, scheduleStatus, teacher, course, students, userTz = PKT) {
  // Normalise: accept single object (legacy) or array
  if (students && !Array.isArray(students)) students = [students];
  // Determine effective status for color
  const effectiveStatus = session.status === 'scheduled' && scheduleStatus === 'pending'
    ? 'pending'
    : session.status;

  // A session is only shown as "live" when it is actively ongoing.
  // Cancelled / completed / makeup sessions must never render green even if
  // their sessionStatus was not reset when they were cancelled.
  const isLive = session.sessionStatus === 'live' &&
    effectiveStatus !== 'cancelled' &&
    effectiveStatus !== 'completed' &&
    effectiveStatus !== 'makeup';
  const color = isLive
    ? SESSION_COLORS.live
    : (SESSION_COLORS[effectiveStatus] || SESSION_COLORS.scheduled);

  const meetingLink = session.meetingLink || (session.schedule ? session.schedule.meetingLink : null);

  // Convert times from PKT (reference timezone) to user's timezone
  const startMoment = moment.tz(`${session.date} ${session.startTime}`, 'YYYY-MM-DD HH:mm:ss', PKT).tz(userTz);
  const endMoment   = moment.tz(`${session.date} ${session.endTime}`,   'YYYY-MM-DD HH:mm:ss', PKT).tz(userTz);

  return {
    id: `session-${session.id}`,
    title: session.title,
    start: startMoment.format('YYYY-MM-DDTHH:mm:ss'),
    end:   endMoment.format('YYYY-MM-DDTHH:mm:ss'),
    backgroundColor: color,
    borderColor: color,
    classNames: isLive ? ['event-live'] : [],
    extendedProps: {
      type: 'class',
      status: effectiveStatus,
      // If the raw DB value is 'live' but the session is now cancelled/completed/makeup,
      // return 'ended' so the frontend never shows the LIVE badge on a non-active session.
      sessionStatus: isLive ? 'live' : (session.sessionStatus === 'live' ? 'ended' : (session.sessionStatus || 'idle')),
      sessionId: session.id,
      scheduleId: session.scheduleId,
      roomId: session.roomId || null,
      meetingLink,
      courseId: session.courseId || null,
      courseName: course ? course.courseName : null,
      teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : null,
      teacherImageUrl: teacher ? teacher.imageUrl : null,
      // students[] from junction table — empty means group session
      studentIds: (students || []).map((s) => s.id),
      studentNames: (students || []).map((s) => `${s.firstName} ${s.lastName}`),
      // Convenience aliases kept for backward compat
      studentId: students && students.length === 1 ? students[0].id : null,
      studentName: students && students.length === 1
        ? `${students[0].firstName} ${students[0].lastName}`
        : students && students.length > 1 ? `${students.length} students` : null,
      cancellationReason: session.cancellationReason || null,
      shift: session.shift || null,
      lessonTitle: session.lessonTitle || null,
      lessonDescription: session.lessonDescription || null,
      lessonDueDate: session.lessonDueDate || null,
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: format Quiz into a FullCalendar event
// ---------------------------------------------------------------------------
function formatQuizEvent(quiz, courseName) {
  // Quizzes don't have a fixed date — use createdAt as a reference;
  // the frontend can show them differently. Use a point-in-time event.
  const dateStr = quiz.createdAt ? new Date(quiz.createdAt).toISOString().slice(0, 10) : null;
  if (!dateStr) return null;
  return {
    id: `quiz-${quiz.id}`,
    title: `Quiz: ${quiz.title}`,
    start: dateStr,
    end: dateStr,
    backgroundColor: EVENT_COLORS.quiz,
    borderColor: EVENT_COLORS.quiz,
    allDay: true,
    extendedProps: {
      type: 'quiz',
      status: quiz.status,
      quizId: quiz.id,
      courseName,
      duration: quiz.duration,
      passingScore: quiz.passingScore,
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: format Assignment into a FullCalendar event
// ---------------------------------------------------------------------------
function formatAssignmentEvent(assignment, courseName) {
  if (!assignment.dueDate) return null;
  const dateStr = new Date(assignment.dueDate).toISOString().slice(0, 10);
  return {
    id: `assignment-${assignment.id}`,
    title: `Assignment: ${assignment.title}`,
    start: dateStr,
    end: dateStr,
    backgroundColor: EVENT_COLORS.assignment,
    borderColor: EVENT_COLORS.assignment,
    allDay: true,
    extendedProps: {
      type: 'assignment',
      status: assignment.status,
      assignmentId: assignment.id,
      courseName,
      dueDate: assignment.dueDate,
      maxScore: assignment.maxScore,
    },
  };
}

// ---------------------------------------------------------------------------
// GET /api/class-schedule/events?userId=&role=&start=&end=
// Main calendar data endpoint — returns unified event list for FullCalendar
// ---------------------------------------------------------------------------
exports.getCalendarEvents = async (req, res) => {
  try {
    const { userId, role, start, end, timezone } = req.query;
    if (!userId || !role) {
      return res.status(400).json({ message: 'userId and role are required' });
    }

    // Use PKT as the canonical reference timezone; convert to user's tz when building events
    const userTz = (timezone && moment.tz.zone(timezone)) ? timezone : PKT;

    // Expand the requested date range by ±1 day so that sessions near midnight
    // PKT still appear after conversion to a distant timezone (e.g. UTC-12 / UTC+14)
    const dateFilter = {};
    if (start) dateFilter[Op.gte] = moment.tz(start, PKT).subtract(1, 'day').format('YYYY-MM-DD');
    if (end)   dateFilter[Op.lte] = moment.tz(end,   PKT).add(1, 'day').format('YYYY-MM-DD');
    const sessionWhere = Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {};

    const events = [];

    // -----------------------------------------------------------------------
    // Fetch sessions based on role
    // -----------------------------------------------------------------------
    let sessions = [];

    // Common session includes used by all roles
    const sessionIncludes = [
      { model: ClassSchedule, as: 'schedule', attributes: ['status', 'meetingLink', 'createdBy'] },
      { model: Courses, foreignKey: 'courseId', attributes: ['id', 'courseName'] },
      { model: Teacher, foreignKey: 'teacherId', attributes: ['id', 'firstName', 'lastName', 'imageUrl'] },
      { model: Student, as: 'Students', through: { attributes: [] }, attributes: ['id', 'firstName', 'lastName'], required: false },
    ];

    if (role === 'admin') {
      const adminLimit = Object.keys(sessionWhere).length === 0 ? 500 : undefined;
      sessions = await ClassSession.findAll({
        where: sessionWhere,
        include: sessionIncludes,
        order: [['date', 'ASC']],
        ...(adminLimit ? { limit: adminLimit } : {}),
      });
    } else if (role === 'teacher') {
      sessions = await ClassSession.findAll({
        where: { ...sessionWhere, teacherId: userId },
        include: sessionIncludes,
        order: [['date', 'ASC']],
      });
    } else if (role === 'student') {
      const [studentRecord, enrolledCourses] = await Promise.all([
        Student.findByPk(userId, { attributes: ['id', 'shift'] }),
        CourseDetails.findAll({ where: { studentId: userId }, attributes: ['courseId'] }),
      ]);
      const studentShift = studentRecord ? studentRecord.shift : null;
      const enrolledCourseIds = enrolledCourses.map((cd) => cd.courseId);
      const courseIdFilter = enrolledCourseIds.length > 0 ? { [Op.in]: enrolledCourseIds } : { [Op.eq]: -1 };

      // A session is visible if:
      //   (a) student is in ClassSessionStudents for this session, OR
      //   (b) session has NO ClassSessionStudents rows (group) AND enrolled in course AND shift matches
      const { literal } = require('sequelize');
      const assignedToMe = literal(
        `(SELECT COUNT(*) FROM ClassSessionStudents WHERE ClassSessionStudents.sessionId = ClassSession.id) > 0 AND ` +
        `EXISTS (SELECT 1 FROM ClassSessionStudents WHERE ClassSessionStudents.sessionId = ClassSession.id AND ClassSessionStudents.studentId = ${Number(userId)})`
      );
      const isGroup = literal(
        `(SELECT COUNT(*) FROM ClassSessionStudents WHERE ClassSessionStudents.sessionId = ClassSession.id) = 0`
      );

      let groupCond;
      if (studentShift) {
        groupCond = {
          [Op.and]: [
            { [Op.and]: [literal(`(SELECT COUNT(*) FROM ClassSessionStudents WHERE ClassSessionStudents.sessionId = ClassSession.id) = 0`)] },
            { courseId: courseIdFilter },
            { [Op.or]: [{ shift: studentShift }, { shift: null }] },
          ],
        };
      } else {
        groupCond = {
          [Op.and]: [
            { [Op.and]: [literal(`(SELECT COUNT(*) FROM ClassSessionStudents WHERE ClassSessionStudents.sessionId = ClassSession.id) = 0`)] },
            { courseId: courseIdFilter },
          ],
        };
      }

      sessions = await ClassSession.findAll({
        where: {
          ...sessionWhere,
          [Op.or]: [
            { [Op.and]: [literal(`EXISTS (SELECT 1 FROM ClassSessionStudents WHERE ClassSessionStudents.sessionId = ClassSession.id AND ClassSessionStudents.studentId = ${Number(userId)})`)] },
            groupCond,
          ],
        },
        include: sessionIncludes,
        order: [['date', 'ASC']],
      });
    } else if (role === 'parent') {
      const children = await Student.findAll({
        where: { parentId: userId },
        attributes: ['id', 'firstName', 'lastName', 'shift'],
      });

      if (children.length === 0) {
        sessions = [];
      } else {
        const childEnrollments = await Promise.all(
          children.map(async (child) => {
            const cds = await CourseDetails.findAll({ where: { studentId: child.id }, attributes: ['courseId'] });
            return { child, courseIds: cds.map((cd) => cd.courseId) };
          })
        );

        const { literal } = require('sequelize');
        const orConditions = [];
        for (const { child, courseIds } of childEnrollments) {
          // Sessions specifically assigned to this child
          orConditions.push({
            [Op.and]: [literal(`EXISTS (SELECT 1 FROM ClassSessionStudents WHERE ClassSessionStudents.sessionId = ClassSession.id AND ClassSessionStudents.studentId = ${Number(child.id)})`)],
          });
          // Group sessions in enrolled courses (with shift filter)
          const childCourseFilter = courseIds.length > 0 ? { [Op.in]: courseIds } : { [Op.eq]: -1 };
          const groupBase = {
            [Op.and]: [
              { [Op.and]: [literal(`(SELECT COUNT(*) FROM ClassSessionStudents WHERE ClassSessionStudents.sessionId = ClassSession.id) = 0`)] },
              { courseId: childCourseFilter },
            ],
          };
          if (child.shift) {
            orConditions.push({ [Op.and]: [groupBase, { [Op.or]: [{ shift: child.shift }, { shift: null }] }] });
          } else {
            orConditions.push(groupBase);
          }
        }

        sessions = await ClassSession.findAll({
          where: { ...sessionWhere, [Op.or]: orConditions },
          include: sessionIncludes,
          order: [['date', 'ASC']],
        });
      }
    }

    // Format sessions into FullCalendar events
    for (const session of sessions) {
      const scheduleStatus = session.schedule ? session.schedule.status : 'active';
      const teacher = session.Teacher || null;
      const course = session.Course || null;
      const students = session.Students || [];
      events.push(formatSessionEvent(session, scheduleStatus, teacher, course, students, userTz));
    }

    // -----------------------------------------------------------------------
    // Fetch quizzes and assignments (for student and admin roles)
    // -----------------------------------------------------------------------
    if (role === 'student') {
      // Get student's CourseDetails to find their quizzes and assignments
      const courseDetails = await CourseDetails.findAll({
        where: { studentId: userId },
        attributes: ['id', 'courseId'],
        include: [{ model: Courses, foreignKey: 'courseId', attributes: ['courseName'] }],
      });

      const courseDetailsIds = courseDetails.map((cd) => cd.id);
      const courseNameMap = {};
      courseDetails.forEach((cd) => {
        courseNameMap[cd.id] = cd.Course ? cd.Course.courseName : '';
      });

      if (courseDetailsIds.length > 0) {
        const [quizzes, assignments] = await Promise.all([
          Quiz.findAll({
            where: {
              courseDetailsId: { [Op.in]: courseDetailsIds },
              status: 'active',
            },
            attributes: ['id', 'title', 'duration', 'passingScore', 'status', 'createdAt', 'courseDetailsId'],
          }),
          Assignment.findAll({
            where: {
              courseDetailsId: { [Op.in]: courseDetailsIds },
              status: 'active',
              dueDate: Object.keys(dateFilter).length > 0 ? dateFilter : { [Op.not]: null },
            },
            attributes: ['id', 'title', 'dueDate', 'maxScore', 'status', 'courseDetailsId'],
          }),
        ]);

        for (const quiz of quizzes) {
          const ev = formatQuizEvent(quiz, courseNameMap[quiz.courseDetailsId] || '');
          if (ev) events.push(ev);
        }
        for (const assignment of assignments) {
          const ev = formatAssignmentEvent(assignment, courseNameMap[assignment.courseDetailsId] || '');
          if (ev) events.push(ev);
        }
      }
    } else if (role === 'teacher') {
      // Get teacher's quizzes and assignments
      const [quizzes, assignments] = await Promise.all([
        Quiz.findAll({
          where: { teacherId: userId, status: 'active' },
          attributes: ['id', 'title', 'duration', 'passingScore', 'status', 'createdAt', 'courseDetailsId'],
          include: [{ model: CourseDetails, as: 'CourseDetails', include: [{ model: Courses, foreignKey: 'courseId', attributes: ['courseName'] }] }],
        }),
        Assignment.findAll({
          where: {
            teacherId: userId,
            status: 'active',
            dueDate: Object.keys(dateFilter).length > 0 ? dateFilter : { [Op.not]: null },
          },
          attributes: ['id', 'title', 'dueDate', 'maxScore', 'status', 'courseDetailsId'],
          include: [{ model: CourseDetails, as: 'CourseDetails', include: [{ model: Courses, foreignKey: 'courseId', attributes: ['courseName'] }] }],
        }),
      ]);

      for (const quiz of quizzes) {
        const courseName = quiz.CourseDetails && quiz.CourseDetails.Course ? quiz.CourseDetails.Course.courseName : '';
        const ev = formatQuizEvent(quiz, courseName);
        if (ev) events.push(ev);
      }
      for (const assignment of assignments) {
        const courseName = assignment.CourseDetails && assignment.CourseDetails.Course ? assignment.CourseDetails.Course.courseName : '';
        const ev = formatAssignmentEvent(assignment, courseName);
        if (ev) events.push(ev);
      }
    } else if (role === 'admin') {
      // Admin sees all active quizzes and assignments
      const [quizzes, assignments] = await Promise.all([
        Quiz.findAll({
          where: { status: 'active' },
          attributes: ['id', 'title', 'duration', 'passingScore', 'status', 'createdAt', 'courseDetailsId'],
          include: [{ model: CourseDetails, as: 'CourseDetails', include: [{ model: Courses, foreignKey: 'courseId', attributes: ['courseName'] }] }],
          limit: 200, // cap for admin overview
        }),
        Assignment.findAll({
          where: {
            status: 'active',
            dueDate: Object.keys(dateFilter).length > 0 ? dateFilter : { [Op.not]: null },
          },
          attributes: ['id', 'title', 'dueDate', 'maxScore', 'status', 'courseDetailsId'],
          include: [{ model: CourseDetails, as: 'CourseDetails', include: [{ model: Courses, foreignKey: 'courseId', attributes: ['courseName'] }] }],
          limit: 200,
        }),
      ]);

      for (const quiz of quizzes) {
        const courseName = quiz.CourseDetails && quiz.CourseDetails.Course ? quiz.CourseDetails.Course.courseName : '';
        const ev = formatQuizEvent(quiz, courseName);
        if (ev) events.push(ev);
      }
      for (const assignment of assignments) {
        const courseName = assignment.CourseDetails && assignment.CourseDetails.Course ? assignment.CourseDetails.Course.courseName : '';
        const ev = formatAssignmentEvent(assignment, courseName);
        if (ev) events.push(ev);
      }
    }

    return res.json(events);
  } catch (err) {
    console.error('getCalendarEvents error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/class-schedule/sessions/:sessionId/join
// Generates a secure join URL via the calling-app.
// Teachers/admins can join regardless of sessionStatus.
// Students can only join when sessionStatus === 'live'.
// ---------------------------------------------------------------------------
exports.joinSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId, role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ message: 'userId and role are required' });
    }

    // Cross-check: role in body must match the JWT-authenticated userType (prevents role spoofing)
    const jwtRole = (req.userType || '').toLowerCase();
    if (role !== jwtRole) {
      return res.status(403).json({ message: 'Role mismatch: claimed role does not match your token.' });
    }

    const session = await ClassSession.findByPk(sessionId, {
      include: [
        { model: Teacher, foreignKey: 'teacherId', attributes: ['id', 'firstName', 'lastName'] },
      ],
    });

    if (!session) return res.status(404).json({ message: 'Session not found' });

    // Authorization check
    if (role === 'teacher' && String(session.teacherId) !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized for this session' });
    }
    if (role === 'student') {
      // Check junction table: if session has specific students assigned, this student must be one of them
      const assignedRows = await ClassSessionStudent.findAll({ where: { sessionId }, attributes: ['studentId'] });
      const isPersonalSession = assignedRows.length > 0;
      if (isPersonalSession && !assignedRows.find((r) => String(r.studentId) === String(userId))) {
        return res.status(403).json({ message: 'Not authorized for this session' });
      }
      if (session.sessionStatus !== 'live') {
        return res.status(403).json({ message: 'Session is not live yet. Wait for the teacher to start.' });
      }
    }

    if (!session.roomId) {
      return res.status(500).json({ message: 'Session has no room ID — please contact admin' });
    }

    const isPresenter = role === 'teacher' || role === 'admin';

    // Determine display name
    let userName = 'Participant';
    if (role === 'teacher' && session.Teacher) {
      userName = `${session.Teacher.firstName} ${session.Teacher.lastName}`;
    } else if (role === 'student') {
      const requestingStudent = await Student.findByPk(userId, { attributes: ['firstName', 'lastName'] });
      if (requestingStudent) {
        userName = `${requestingStudent.firstName} ${requestingStudent.lastName}`;
      }
    } else if (role === 'admin') {
      userName = 'Admin';
    }

    // Extract the raw JWT to pass to the calling app so it can call LMS APIs directly
    const authHeader = req.get('Authorization') || '';
    const lmsToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const lmsApiUrl = process.env.LMS_API_URL || 'http://localhost:8080';

    const lmsParams = {
      lmsSessionId: String(session.id),
      lmsCourseId: session.courseDetailsId ? String(session.courseDetailsId) : '',
      lmsToken,
      lmsApiUrl,
      lmsUserRole: role,
    };

    const joinUrl = await callingAppService.createJoinUrl(session.roomId, userName, isPresenter, false, false, lmsParams);

    return res.json({ joinUrl, roomId: session.roomId });
  } catch (err) {
    console.error('joinSession error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/class-schedule/sessions/:sessionId/start
// Teacher or admin starts the live session.
// Emits session:started to all subscribed socket clients.
// ---------------------------------------------------------------------------
exports.startSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId, role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ message: 'userId and role are required' });
    }

    // Cross-check: role in body must match the JWT-authenticated userType (prevents role spoofing)
    const jwtRole = (req.userType || '').toLowerCase();
    if (role !== jwtRole) {
      return res.status(403).json({ message: 'Role mismatch: claimed role does not match your token.' });
    }
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ message: 'Only teachers and admins can start a session' });
    }

    const session = await ClassSession.findByPk(sessionId, {
      include: [
        { model: Teacher, foreignKey: 'teacherId', attributes: ['id', 'firstName', 'lastName'] },
        { model: Courses, foreignKey: 'courseId', attributes: ['id', 'courseName'] },
      ],
    });

    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (role === 'teacher' && String(session.teacherId) !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized for this session' });
    }
    if (session.sessionStatus === 'live') {
      return res.json({ message: 'Session already live', sessionStatus: 'live' });
    }

    await session.update({ sessionStatus: 'live', liveStartedAt: new Date() });

    // Emit real-time notification to all subscribed clients
    try {
      const ioPromise = socket.getIO();
      if (ioPromise) {
        const io = await ioPromise;
        const teacherName = session.Teacher
          ? `${session.Teacher.firstName} ${session.Teacher.lastName}`
          : 'Teacher';
        const courseName = session.Course ? session.Course.courseName : '';
        io.to(`session-${sessionId}`).emit('session:started', {
          sessionId: Number(sessionId),
          title: session.title,
          teacherName,
          courseName,
          courseId: session.courseId || null,
          roomId: session.roomId,
        });
      }
    } catch (socketErr) {
      console.error('Socket emit error (non-fatal):', socketErr.message);
    }

    // Notify enrolled students that the session is live (DB notification — they also get a Socket.IO live toast)
    try {
      const enrolledStudents = await CourseDetails.findAll({
        where: { courseId: session.courseId, teacherId: session.teacherId },
        attributes: ['studentId'],
      });
      const teacherName = session.Teacher
        ? `${session.Teacher.firstName} ${session.Teacher.lastName}`
        : 'Your teacher';
      await Promise.all(
        enrolledStudents.map((cd) =>
          notify({
            userId: cd.studentId,
            userType: 'student',
            title: 'Class Started',
            message: `${teacherName} started the class "${session.title}". Join now!`,
          })
        )
      );
    } catch (notifErr) {
      console.error('Notification error (non-fatal):', notifErr.message);
    }

    return res.json({ message: 'Session started', sessionStatus: 'live' });
  } catch (err) {
    console.error('startSession error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/class-schedule/sessions/:sessionId/end
// Teacher or admin ends the live session.
// Emits session:ended to all subscribed socket clients.
// ---------------------------------------------------------------------------
exports.endSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId, role, lessonTitle, lessonDescription, lessonDueDate } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ message: 'userId and role are required' });
    }

    // Cross-check: role in body must match the JWT-authenticated userType (prevents role spoofing)
    const jwtRole = (req.userType || '').toLowerCase();
    if (role !== jwtRole) {
      return res.status(403).json({ message: 'Role mismatch: claimed role does not match your token.' });
    }
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ message: 'Only teachers and admins can end a session' });
    }

    const session = await ClassSession.findByPk(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (role === 'teacher' && String(session.teacherId) !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized for this session' });
    }

    // Mark both sessionStatus=ended AND status=completed so attendance/reporting works
    // Also save the teacher's lesson note if provided
    const updateData = { sessionStatus: 'ended', status: 'completed' };
    if (lessonTitle !== undefined) updateData.lessonTitle = lessonTitle || null;
    if (lessonDescription !== undefined) updateData.lessonDescription = lessonDescription || null;
    if (lessonDueDate !== undefined) updateData.lessonDueDate = lessonDueDate || null;
    await session.update(updateData);

    try {
      const ioPromise = socket.getIO();
      if (ioPromise) {
        const io = await ioPromise;
        io.to(`session-${sessionId}`).emit('session:ended', {
          sessionId: Number(sessionId),
          title: session.title,
          lessonTitle: lessonTitle || null,
          lessonDescription: lessonDescription || null,
          lessonDueDate: lessonDueDate || null,
        });
      }
    } catch (socketErr) {
      console.error('Socket emit error (non-fatal):', socketErr.message);
    }

    return res.json({ message: 'Session ended', sessionStatus: 'ended', status: 'completed' });
  } catch (err) {
    console.error('endSession error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/class-schedule/sessions/:sessionId/lesson
// Teacher (or admin) can update lesson note on an ended/completed session.
// ---------------------------------------------------------------------------
exports.updateLesson = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId, role, lessonTitle, lessonDescription, lessonDueDate } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ message: 'userId and role are required' });
    }

    const jwtRole = (req.userType || '').toLowerCase();
    if (role !== jwtRole) {
      return res.status(403).json({ message: 'Role mismatch' });
    }
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ message: 'Only teachers and admins can update lesson notes' });
    }

    const session = await ClassSession.findByPk(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (role === 'teacher' && String(session.teacherId) !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized for this session' });
    }

    await session.update({
      lessonTitle: lessonTitle !== undefined ? (lessonTitle || null) : session.lessonTitle,
      lessonDescription: lessonDescription !== undefined ? (lessonDescription || null) : session.lessonDescription,
      lessonDueDate: lessonDueDate !== undefined ? (lessonDueDate || null) : session.lessonDueDate,
    });

    return res.json({
      message: 'Lesson note updated',
      lessonTitle: session.lessonTitle,
      lessonDescription: session.lessonDescription,
      lessonDueDate: session.lessonDueDate,
    });
  } catch (err) {
    console.error('updateLesson error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/class-schedule/lessons?userId=&role=
// Returns ended/completed sessions that have a lessonTitle, for lesson history pages.
// ---------------------------------------------------------------------------
exports.fetchLessons = async (req, res) => {
  try {
    const { userId, role } = req.query;
    if (!userId || !role) {
      return res.status(400).json({ message: 'userId and role are required' });
    }

    let where = {
      lessonTitle: { [Op.ne]: null },
      [Op.or]: [{ status: 'completed' }, { sessionStatus: 'ended' }],
    };

    // For student: sessions they were enrolled in (via junction table or legacy studentId)
    if (role === 'student') {
      const junctionRows = await ClassSessionStudent.findAll({ where: { studentId: userId }, attributes: ['sessionId'] });
      const sessionIds = junctionRows.map((r) => r.sessionId);
      where = {
        [Op.and]: [
          { lessonTitle: { [Op.ne]: null } },
          { [Op.or]: [{ status: 'completed' }, { sessionStatus: 'ended' }] },
          sessionIds.length > 0
            ? { [Op.or]: [{ studentId: userId }, { id: { [Op.in]: sessionIds } }] }
            : { studentId: userId },
        ],
      };
    } else if (role === 'teacher') {
      where.teacherId = userId;
    }
    // admin: no additional filter — returns all sessions with lesson notes

    const sessions = await ClassSession.findAll({
      where,
      include: [
        { model: Teacher, as: 'Teacher', attributes: ['id', 'firstName', 'lastName'] },
        { model: Courses, as: 'Course', attributes: ['id', 'courseName'] },
      ],
      order: [['date', 'DESC'], ['startTime', 'DESC']],
      limit: 100,
    });

    const lessons = sessions.map((s) => ({
      sessionId: s.id,
      sessionTitle: s.title,
      sessionDate: s.date,
      startTime: s.startTime,
      lessonTitle: s.lessonTitle,
      lessonDescription: s.lessonDescription,
      lessonDueDate: s.lessonDueDate,
      courseName: s.Course ? s.Course.courseName : null,
      courseId: s.courseId,
      teacherName: s.Teacher ? `${s.Teacher.firstName} ${s.Teacher.lastName}` : null,
      teacherId: s.teacherId,
    }));

    return res.json({ lessons });
  } catch (err) {
    console.error('fetchLessons error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// Admin: edit safe fields of a single session
// PUT /api/class-schedule/sessions/:sessionId
// Allowed only when status=scheduled AND sessionStatus=idle
// ---------------------------------------------------------------------------
exports.updateSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title, date, startTime, endTime, notes, shift, meetingLink, teacherId, studentIds } = req.body;

    const session = await ClassSession.findByPk(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (session.status !== 'scheduled') {
      return res.status(400).json({ message: 'Only scheduled sessions can be edited' });
    }
    if (session.sessionStatus !== 'idle') {
      return res.status(400).json({ message: 'Cannot edit a live or ended session' });
    }

    // Resolve teacher reassignment
    const oldTeacherId = session.teacherId;
    const isTeacherChanging = teacherId !== undefined && Number(teacherId) !== Number(oldTeacherId);

    if (isTeacherChanging) {
      const newTeacher = await Teacher.findByPk(teacherId, { attributes: ['id', 'firstName', 'lastName'] });
      if (!newTeacher) return res.status(404).json({ message: 'New teacher not found' });
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (date !== undefined) updates.date = date;
    if (startTime !== undefined) updates.startTime = startTime;
    if (endTime !== undefined) updates.endTime = endTime;
    if (notes !== undefined) updates.notes = notes;
    if (shift !== undefined) updates.shift = shift;
    if (meetingLink !== undefined) updates.meetingLink = meetingLink;
    if (isTeacherChanging) updates.teacherId = Number(teacherId);

    await session.update(updates);

    // Handle student assignment via junction table
    if (Array.isArray(studentIds)) {
      // Remove existing junction rows and replace with new selection
      await ClassSessionStudent.destroy({ where: { sessionId: session.id } });
      if (studentIds.length > 0) {
        await ClassSessionStudent.bulkCreate(
          studentIds.map((sid) => ({ sessionId: session.id, studentId: Number(sid) })),
          { ignoreDuplicates: true }
        );
      }
    }

    // -----------------------------------------------------------------------
    // Notifications
    // -----------------------------------------------------------------------
    try {
      const sessionLabel = `"${session.title}" on ${session.date}`;

      if (isTeacherChanging) {
        // 1. Notify old teacher — removed from session
        await notify({
          userId: oldTeacherId,
          userType: 'TEACHER',
          title: 'Removed from Session',
          message: `You have been unassigned from the class ${sessionLabel}. Please check with the admin for details.`,
        });

        // 2. Notify new teacher — assigned to session
        await notify({
          userId: Number(teacherId),
          userType: 'TEACHER',
          title: 'Assigned to Session',
          message: `You have been assigned to teach the class ${sessionLabel}. Please check your schedule.`,
        });

        // 3. Notify old teacher's students + parents — their teacher changed
        if (session.courseId) {
          const oldEnrollments = await CourseDetails.findAll({
            where: { courseId: session.courseId, teacherId: oldTeacherId },
            include: [{ model: Student, attributes: ['id', 'parentId'] }],
          });
          await Promise.all(
            oldEnrollments.map(async (cd) => {
              if (!cd.Student) return;
              await notify({
                userId: cd.Student.id,
                userType: 'STUDENT',
                title: 'Session Teacher Changed',
                message: `The teacher for your class ${sessionLabel} has been changed. Please check your schedule.`,
              });
              if (cd.Student.parentId) {
                await notify({
                  userId: cd.Student.parentId,
                  userType: 'PARENT',
                  title: 'Session Teacher Changed',
                  message: `The teacher for your child's class ${sessionLabel} has been changed.`,
                });
              }
            })
          );
        }
      } else {
        // Regular update — notify the (unchanged) teacher
        const changedFields = Object.keys(updates).join(', ');
        const updateMsg = `The class ${sessionLabel} has been updated (${changedFields} changed). Please check the schedule.`;
        await notify({ userId: oldTeacherId, userType: 'TEACHER', title: 'Class Updated', message: updateMsg });

        // Notify students + parents of unchanged teacher
        if (session.courseId && oldTeacherId) {
          const enrolledStudents = await CourseDetails.findAll({
            where: { courseId: session.courseId, teacherId: oldTeacherId },
            include: [{ model: Student, attributes: ['id', 'parentId'] }],
          });
          await Promise.all(
            enrolledStudents.map(async (cd) => {
              if (!cd.Student) return;
              await notify({ userId: cd.Student.id, userType: 'STUDENT', title: 'Class Updated', message: updateMsg });
              if (cd.Student.parentId) {
                await notify({ userId: cd.Student.parentId, userType: 'PARENT', title: 'Class Updated', message: updateMsg });
              }
            })
          );
        }
      }
    } catch (notifErr) {
      console.error('Notification error (non-fatal):', notifErr.message);
    }

    return res.json({
      message: isTeacherChanging
        ? 'Session updated. Old teacher unassigned, new teacher assigned. Students notified.'
        : 'Session updated',
      session,
      teacherReassigned: isTeacherChanging,
    });
  } catch (err) {
    console.error('updateSession error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// Admin: list ClassSession rows with optional filters (table view)
// GET /api/class-schedule/sessions-list
// Query: startDate, endDate, teacherId, courseId, status, shift, sessionStatus
// ---------------------------------------------------------------------------
exports.getSessionsList = async (req, res) => {
  try {
    const { startDate, endDate, teacherId, teacherIds, courseId, status, shift, sessionStatus, studentIds } = req.query;

    const where = {};

    if (startDate && endDate) {
      where.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.date = { [Op.gte]: startDate };
    } else if (endDate) {
      where.date = { [Op.lte]: endDate };
    }

    // teacherIds (multi-select, comma-separated) takes precedence over legacy teacherId
    if (teacherIds) {
      const ids = teacherIds.split(',').map((id) => Number(id.trim())).filter(Boolean);
      if (ids.length > 0) where.teacherId = { [Op.in]: ids };
    } else if (teacherId) {
      where.teacherId = teacherId;
    }
    if (courseId) where.courseId = courseId;
    if (status) where.status = status;
    if (shift) where.shift = shift;
    if (sessionStatus) where.sessionStatus = sessionStatus;

    // Filter to only sessions that have a saved transcript
    if (req.query.hasTranscript === 'true') {
      where.transcriptText = { [Op.ne]: null };
    }

    const sessions = await ClassSession.findAll({
      where,
      include: [
        {
          model: Teacher,
          attributes: ['id', 'firstName', 'lastName', 'imageUrl', 'shift'],
        },
        {
          model: Courses,
          attributes: ['id', 'courseName', 'imageUrl'],
        },
        {
          model: ClassSchedule,
          as: 'schedule',
          attributes: ['id', 'recurrenceType', 'daysOfWeek', 'title', 'status'],
          required: false,
        },
        {
          model: Student,
          as: 'Students',
          through: { attributes: [] },
          attributes: ['id', 'firstName', 'lastName', 'profileImg'],
          required: false,
        },
      ],
      order: [
        ['date', 'ASC'],
        ['startTime', 'ASC'],
      ],
    });

    // For group sessions (no junction rows), attach all enrolled students from CourseDetails
    const sessionIds = sessions.filter((s) => !s.Students || s.Students.length === 0).map((s) => s.id);
    const courseIds = [...new Set(sessions.filter((s) => !s.Students || s.Students.length === 0).map((s) => s.courseId))];
    let enrolledStudentMap = {};
    if (courseIds.length > 0) {
      const enrollments = await CourseDetails.findAll({
        where: { courseId: courseIds },
        include: [{ model: Student, attributes: ['id', 'firstName', 'lastName', 'profileImg'] }],
        attributes: ['id', 'courseId'],
      });
      enrollments.forEach((cd) => {
        if (!cd.Student) return;
        const key = String(cd.courseId);
        if (!enrolledStudentMap[key]) enrolledStudentMap[key] = [];
        if (!enrolledStudentMap[key].find((s) => s.id === cd.Student.id)) {
          enrolledStudentMap[key].push(cd.Student);
        }
      });
    }

    let result = sessions.map((s) => {
      // If session has specific students via junction table, use those
      // Otherwise it's a group session — show all enrolled students for the course
      const junctionStudents = s.Students || [];
      const students = junctionStudents.length > 0
        ? junctionStudents
        : (enrolledStudentMap[String(s.courseId)] || []);
      return { ...s.toJSON(), students };
    });

    // Post-filter by studentIds (comma-separated) — applied after student resolution
    if (studentIds) {
      const sIds = studentIds.split(',').map((id) => Number(id.trim())).filter(Boolean);
      if (sIds.length > 0) {
        result = result.filter((s) =>
          s.students.some((stu) => sIds.includes(Number(stu.id)))
        );
      }
    }

    return res.json({ sessions: result });
  } catch (err) {
    console.error('getSessionsList error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// Admin: teacher availability for a given date + time window
// GET /api/class-schedule/teacher-availability
// Query: date (YYYY-MM-DD), startTime (HH:MM), endTime (HH:MM)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// DELETE /api/class-schedule/sessions/:sessionId  — Hard-delete a session
// Blocks live sessions. Cleans up all child records and notifies affected actors.
// ---------------------------------------------------------------------------
exports.deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await ClassSession.findByPk(sessionId, {
      include: [
        { model: Teacher, foreignKey: 'teacherId', attributes: ['id', 'firstName', 'lastName'] },
        { model: Courses, foreignKey: 'courseId', attributes: ['id', 'courseName'] },
        { model: Student, as: 'Students', through: { attributes: [] }, attributes: ['id', 'firstName', 'lastName', 'parentId'] },
      ],
    });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (session.sessionStatus === 'live') {
      return res.status(400).json({ message: 'Cannot delete a live session. End the session first.' });
    }

    // -----------------------------------------------------------------------
    // Collect actors to notify before deletion
    // -----------------------------------------------------------------------
    const deleteMsg = `The class "${session.title}" on ${session.date} has been permanently deleted by the admin.`;

    // Assigned students via junction table; fall back to all enrolled for group sessions
    let studentsToNotify = session.Students || [];
    const parentIds = new Set();
    if (studentsToNotify.length === 0 && session.courseId) {
      // Group session — find all enrolled students
      const enrollments = await CourseDetails.findAll({
        where: { courseId: session.courseId, teacherId: session.teacherId },
        include: [{ model: Student, attributes: ['id', 'parentId'] }],
      });
      studentsToNotify = enrollments.map((cd) => cd.Student).filter(Boolean);
    }
    studentsToNotify.forEach((s) => { if (s.parentId) parentIds.add(s.parentId); });

    // -----------------------------------------------------------------------
    // Delete all child records in dependency order
    // -----------------------------------------------------------------------

    // 1. Attendance records tied to this session
    await Attendance.destroy({ where: { sessionId } });

    // 2. Session feedback submitted by students
    await SessionFeedback.destroy({ where: { sessionId } });

    // 3. Junction table rows (ClassSessionStudents)
    await ClassSessionStudent.destroy({ where: { sessionId } });

    // 4. Delete the session itself
    await session.destroy();

    // -----------------------------------------------------------------------
    // Notify affected actors (non-fatal)
    // -----------------------------------------------------------------------
    try {
      const notifyPromises = [];

      // Notify teacher
      if (session.teacherId) {
        notifyPromises.push(
          notify({ userId: session.teacherId, userType: 'TEACHER', title: 'Session Deleted', message: deleteMsg })
        );
      }

      // Notify each student
      for (const student of studentsToNotify) {
        notifyPromises.push(
          notify({ userId: student.id, userType: 'STUDENT', title: 'Session Deleted', message: deleteMsg })
        );
      }

      // Notify parents
      for (const parentId of parentIds) {
        notifyPromises.push(
          notify({ userId: parentId, userType: 'PARENT', title: 'Session Deleted', message: deleteMsg })
        );
      }

      await Promise.all(notifyPromises);
    } catch (notifErr) {
      console.error('Notification error (non-fatal):', notifErr.message);
    }

    return res.json({ message: 'Session deleted. Teacher, students, and parents notified.' });
  } catch (err) {
    console.error('deleteSession error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// GET /api/class-schedule/check-conflicts
// Query: teacherId, courseId, date (YYYY-MM-DD), startTime (HH:MM), endTime (HH:MM)
// Returns teacher conflicts (hard) + student conflicts (soft) for the modal.
// ---------------------------------------------------------------------------
exports.checkConflicts = async (req, res) => {
  try {
    const { teacherId, courseId, date, startTime, endTime } = req.query;
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ message: 'date, startTime, endTime are required' });
    }

    // Only active, non-ended sessions are real conflicts.
    // status ENUM: scheduled | completed | cancelled | makeup  (no 'pending' in this table)
    // sessionStatus ENUM: idle | live | ended
    // Exclude completed (past) and cancelled (dropped).
    // Exclude sessionStatus 'ended' — call finished even if admin hasn't closed it formally.
    const timeOverlap = {
      date,
      status: { [Op.in]: ['scheduled', 'makeup'] },
      sessionStatus: { [Op.notIn]: ['ended'] },
      startTime: { [Op.lt]: endTime },
      endTime: { [Op.gt]: startTime },
    };

    // -----------------------------------------------------------------------
    // 1. Teacher conflicts
    // -----------------------------------------------------------------------
    let teacherConflicts = [];
    if (teacherId) {
      const sessions = await ClassSession.findAll({
        where: { ...timeOverlap, teacherId: Number(teacherId) },
        include: [{ model: Courses, attributes: ['id', 'courseName'] }],
        attributes: ['id', 'title', 'date', 'startTime', 'endTime', 'status', 'sessionStatus'],
      });
      teacherConflicts = sessions.map((s) => s.toJSON());
    }

    // -----------------------------------------------------------------------
    // 2. Student conflicts
    // -----------------------------------------------------------------------
    let studentConflicts = [];
    if (courseId) {
      // Enrolled students — dedup by studentId: one student can appear in multiple
      // CourseDetails rows (different teachers / sections for the same course).
      const enrollments = await CourseDetails.findAll({
        where: { courseId: Number(courseId) },
        include: [{ model: Student, attributes: ['id', 'firstName', 'lastName'], required: true }],
      });
      const seenIds = new Set();
      const enrolledStudents = [];
      for (const e of enrollments) {
        if (e.Student && !seenIds.has(e.Student.id)) {
          seenIds.add(e.Student.id);
          enrolledStudents.push(e.Student);
        }
      }
      const enrolledIds = enrolledStudents.map((s) => s.id);
      const enrolledIdSet = new Set(enrolledIds);

      if (enrolledIds.length > 0) {
        // a) Sessions where enrolled students are EXPLICITLY assigned
        const explicitSessions = await ClassSession.findAll({
          where: timeOverlap,
          include: [
            { model: Courses, attributes: ['id', 'courseName'] },
            {
              model: Student,
              as: 'Students',
              through: { attributes: [] },
              where: { id: { [Op.in]: enrolledIds } },
              attributes: ['id', 'firstName', 'lastName'],
              required: true,
            },
          ],
          attributes: ['id', 'title', 'date', 'startTime', 'endTime', 'status', 'sessionStatus'],
        });

        for (const session of explicitSessions) {
          for (const student of session.Students) {
            studentConflicts.push({
              studentId: student.id,
              studentName: `${student.firstName} ${student.lastName}`,
              session: {
                id: session.id,
                title: session.title,
                date: session.date,
                startTime: session.startTime,
                endTime: session.endTime,
                course: session.Course,
              },
            });
          }
        }

        // b) GROUP sessions (no explicit assignments) of courses that enrolled students are in
        //    Use raw query: ClassSessions with no ClassSessionStudents rows, for courses
        //    that any enrolled student is enrolled in.
        const { QueryTypes } = require('sequelize');
        const otherEnrollments = await CourseDetails.findAll({
          where: { studentId: { [Op.in]: enrolledIds } },
          attributes: ['studentId', 'courseId'],
        });

        // Build map: courseId → Set<studentId> enrolled in that course
        const courseStudentMap = {};
        for (const e of otherEnrollments) {
          if (!courseStudentMap[e.courseId]) courseStudentMap[e.courseId] = new Set();
          courseStudentMap[e.courseId].add(e.studentId);
        }
        const otherCourseIds = Object.keys(courseStudentMap).map(Number);

        // Guard: IN () is invalid SQL — skip if no cross-enrollments found
        if (otherCourseIds.length > 0) {
          const groupSessions = await ClassSession.sequelize.query(
            `SELECT cs.id, cs.title, cs.date, cs.startTime, cs.endTime, cs.status, cs.sessionStatus, cs.courseId,
                    co.courseName
             FROM ClassSessions cs
             JOIN Courses co ON co.id = cs.courseId
             LEFT JOIN ClassSessionStudents css ON css.sessionId = cs.id
             WHERE cs.date = :date
               AND cs.status IN ('scheduled', 'makeup')
               AND cs.sessionStatus NOT IN ('ended')
               AND cs.startTime < :endTime
               AND cs.endTime > :startTime
               AND cs.courseId IN (:otherCourseIds)
             GROUP BY cs.id, cs.title, cs.date, cs.startTime, cs.endTime, cs.status, cs.sessionStatus, cs.courseId, co.courseName
             HAVING COUNT(css.sessionId) = 0`,
            {
              replacements: { date, startTime, endTime, otherCourseIds },
              type: QueryTypes.SELECT,
            }
          );

          // Dedup against already-reported explicit conflicts
          const alreadyReported = new Set(studentConflicts.map((sc) => `${sc.studentId}-${sc.session.id}`));
          for (const gs of groupSessions) {
            const affectedStudentIds = courseStudentMap[gs.courseId] || new Set();
            for (const sid of affectedStudentIds) {
              if (!enrolledIdSet.has(sid)) continue; // only students enrolled in the course being scheduled
              const key = `${sid}-${gs.id}`;
              if (alreadyReported.has(key)) continue;
              alreadyReported.add(key);
              const stu = enrolledStudents.find((s) => s.id === sid);
              if (stu) {
                studentConflicts.push({
                  studentId: stu.id,
                  studentName: `${stu.firstName} ${stu.lastName}`,
                  session: {
                    id: gs.id,
                    title: gs.title,
                    date: gs.date,
                    startTime: gs.startTime,
                    endTime: gs.endTime,
                    course: { id: gs.courseId, courseName: gs.courseName },
                  },
                });
              }
            }
          }
        }
      }
    }

    return res.json({
      teacherConflicts,
      studentConflicts,
      hasTeacherConflict: teacherConflicts.length > 0,
      hasStudentConflict: studentConflicts.length > 0,
    });
  } catch (err) {
    console.error('checkConflicts error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getTeacherAvailability = async (req, res) => {
  try {
    const { date, startTime, endTime } = req.query;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ message: 'date, startTime, and endTime are required' });
    }

    // All teachers
    const teachers = await Teacher.findAll({
      attributes: ['id', 'firstName', 'lastName', 'imageUrl', 'shift'],
      order: [['firstName', 'ASC']],
    });

    // Sessions on that date that overlap the given time window (not cancelled)
    // Overlap condition: session.startTime < endTime AND session.endTime > startTime
    const sessions = await ClassSession.findAll({
      where: {
        date,
        status: { [Op.notIn]: ['cancelled'] },
        startTime: { [Op.lt]: endTime },
        endTime: { [Op.gt]: startTime },
      },
      include: [
        { model: Courses, attributes: ['id', 'courseName'] },
      ],
      attributes: ['id', 'title', 'startTime', 'endTime', 'teacherId', 'status', 'sessionStatus', 'courseId'],
    });

    // Group sessions by teacherId
    const sessionsByTeacher = {};
    for (const s of sessions) {
      const tid = s.teacherId;
      if (!sessionsByTeacher[tid]) sessionsByTeacher[tid] = [];
      sessionsByTeacher[tid].push(s.toJSON());
    }

    const result = teachers.map((t) => {
      const tj = t.toJSON();
      const teacherSessions = sessionsByTeacher[t.id] || [];
      return {
        ...tj,
        isBusy: teacherSessions.length > 0,
        sessions: teacherSessions,
      };
    });

    return res.json({
      teachers: result,
      queryDate: date,
      startTime,
      endTime,
      totalTeachers: result.length,
      freeCount: result.filter((t) => !t.isBusy).length,
      busyCount: result.filter((t) => t.isBusy).length,
    });
  } catch (err) {
    console.error('getTeacherAvailability error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/class-schedule/sessions/:sessionId/transcript
// Called by the calling-app (server-to-server) after Whisper transcription.
// Authenticated by the shared CALLING_APP_API_SECRET header.
// ---------------------------------------------------------------------------
exports.saveTranscript = async (req, res) => {
  try {
    const expectedSecret = process.env.CALLING_APP_API_SECRET;
    const providedSecret = req.headers['x-calling-secret'] || req.headers['authorization'];
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { sessionId } = req.params;
    const { transcriptText } = req.body;
    if (!transcriptText) return res.status(400).json({ message: 'transcriptText is required' });

    const session = await ClassSession.findByPk(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    await session.update({ transcriptText });
    return res.json({ message: 'Transcript saved' });
  } catch (err) {
    console.error('saveTranscript error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/class-schedule/sessions/:sessionId/transcript
// Returns the transcript text for a session. Accessible by teacher/admin/student.
// ---------------------------------------------------------------------------
exports.getTranscript = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await ClassSession.findByPk(sessionId, {
      attributes: ['id', 'title', 'transcriptText'],
    });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    return res.json({
      sessionId: session.id,
      title: session.title,
      transcriptText: session.transcriptText || null,
    });
  } catch (err) {
    console.error('getTranscript error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};
