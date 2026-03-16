const { Op } = require('sequelize');
const moment = require('moment-timezone');
const PKT = 'Asia/Karachi';
const ClassSchedule = require('../models/ClassSchedule');
const ClassSession = require('../models/ClassSession');
const Courses = require('../models/Course');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Quiz = require('../models/Quiz/Quiz');
const Assignment = require('../models/Assignment/Assignment');
const CourseDetails = require('../models/CourseDetails');
const Parent = require('../models/Parent');
const Admin = require('../models/Admin');
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
async function generateSessions(schedule) {
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
    meetingLink,
    courseId,
    teacherId,
    studentId,
    courseDetailsId,
    shift,
  } = schedule;

  const baseSession = {
    scheduleId,
    title,
    startTime,
    endTime,
    meetingLink: null, // sessions inherit from schedule via join; null means "use schedule link"
    status: 'scheduled',
    courseId,
    teacherId,
    studentId,
    courseDetailsId,
    shift: shift || null,
  };

  if (recurrenceType === 'one-time') {
    sessions.push({ ...baseSession, date: startDate });
  } else {
    // Weekly or biweekly
    const interval = recurrenceType === 'biweekly' ? 14 : 7;
    const days = Array.isArray(daysOfWeek) ? daysOfWeek : [];
    const end = endDate ? new Date(endDate) : (() => {
      // Cap at 1 year if no endDate
      const d = new Date(startDate);
      d.setFullYear(d.getFullYear() + 1);
      return d;
    })();

    let current = new Date(startDate);
    // Safety cap: max 500 sessions to avoid runaway generation
    let count = 0;
    while (current <= end && count < 500) {
      if (days.includes(current.getDay())) {
        const dateStr = current.toISOString().slice(0, 10);
        sessions.push({ ...baseSession, date: dateStr });
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
  }

  if (sessions.length > 0) {
    const created = await ClassSession.bulkCreate(sessions, { returning: true });
    // Assign deterministic room IDs now that we have PKs
    const updates = created.map((s) =>
      ClassSession.update({ roomId: `lms-${s.id}` }, { where: { id: s.id } })
    );
    await Promise.all(updates);
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
      meetingLink, courseId, teacherId, studentId, courseDetailsId, shift,
    } = req.body;

    if (!title || !startTime || !endTime || !startDate || !courseId || !teacherId) {
      return res.status(400).json({ message: 'title, startTime, endTime, startDate, courseId, teacherId are required' });
    }
    if ((recurrenceType === 'weekly' || recurrenceType === 'biweekly') && (!daysOfWeek || daysOfWeek.length === 0)) {
      return res.status(400).json({ message: 'daysOfWeek required for weekly/biweekly recurrence' });
    }

    const schedule = await ClassSchedule.create({
      title, description,
      recurrenceType: recurrenceType || 'one-time',
      daysOfWeek: daysOfWeek || null,
      startTime, endTime, startDate,
      endDate: endDate || null,
      meetingLink: meetingLink || null,
      status: 'active',
      createdBy: 'admin',
      courseId, teacherId,
      studentId: studentId || null,
      courseDetailsId: courseDetailsId || null,
      shift: shift || null,
    });

    const sessionCount = await generateSessions(schedule);

    return res.status(201).json({
      message: 'Schedule created successfully',
      schedule,
      sessionCount,
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
      meetingLink, courseId, teacherId, studentId, courseDetailsId, shift,
    } = req.body;

    if (!title || !startTime || !endTime || !startDate || !courseId || !teacherId) {
      return res.status(400).json({ message: 'title, startTime, endTime, startDate, courseId, teacherId are required' });
    }

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
      studentId: studentId || null,
      courseDetailsId: courseDetailsId || null,
      shift: shift || null,
    });

    // Create a single session — will appear as "pending" for admin
    const proposedSession = await ClassSession.create({
      scheduleId: schedule.id,
      title,
      date: startDate,
      startTime, endTime,
      meetingLink: null,
      status: 'scheduled',
      courseId, teacherId,
      studentId: studentId || null,
      courseDetailsId: courseDetailsId || null,
      shift: shift || null,
    });
    await proposedSession.update({ roomId: `lms-${proposedSession.id}` });

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

    return res.status(201).json({ message: 'Session proposed — awaiting admin approval', schedule });
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
    const schedules = await ClassSchedule.findAll({
      where: { studentId, status: 'active' },
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
function formatSessionEvent(session, scheduleStatus, teacher, course, student, userTz = PKT) {
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
      studentName: student ? `${student.firstName} ${student.lastName}` : null,
      cancellationReason: session.cancellationReason || null,
      shift: session.shift || null,
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

    if (role === 'admin') {
      // When no date range is provided, cap to 500 sessions to prevent full-table scans
      const adminLimit = Object.keys(sessionWhere).length === 0 ? 500 : undefined;
      sessions = await ClassSession.findAll({
        where: sessionWhere,
        include: [
          { model: ClassSchedule, as: 'schedule', attributes: ['status', 'meetingLink', 'createdBy'] },
          { model: Courses, foreignKey: 'courseId', attributes: ['id', 'courseName'] },
          { model: Teacher, foreignKey: 'teacherId', attributes: ['id', 'firstName', 'lastName', 'imageUrl'] },
          { model: Student, foreignKey: 'studentId', attributes: ['id', 'firstName', 'lastName'] },
        ],
        order: [['date', 'ASC']],
        ...(adminLimit ? { limit: adminLimit } : {}),
      });
    } else if (role === 'teacher') {
      sessions = await ClassSession.findAll({
        where: { ...sessionWhere, teacherId: userId },
        include: [
          { model: ClassSchedule, as: 'schedule', attributes: ['status', 'meetingLink', 'createdBy'] },
          { model: Courses, foreignKey: 'courseId', attributes: ['id', 'courseName'] },
          { model: Teacher, foreignKey: 'teacherId', attributes: ['id', 'firstName', 'lastName', 'imageUrl'] },
          { model: Student, foreignKey: 'studentId', attributes: ['id', 'firstName', 'lastName'] },
        ],
        order: [['date', 'ASC']],
      });
    } else if (role === 'student') {
      // Fetch student's shift AND enrolled courses in parallel
      const [studentRecord, enrolledCourses] = await Promise.all([
        Student.findByPk(userId, { attributes: ['id', 'shift'] }),
        CourseDetails.findAll({ where: { studentId: userId }, attributes: ['courseId'] }),
      ]);
      const studentShift = studentRecord ? studentRecord.shift : null;
      const enrolledCourseIds = enrolledCourses.map((cd) => cd.courseId);
      // Use -1 sentinel so Op.in never throws on empty array (matches nothing)
      const courseIdFilter = enrolledCourseIds.length > 0 ? { [Op.in]: enrolledCourseIds } : { [Op.eq]: -1 };

      // Personal sessions (studentId = userId): always visible regardless of shift or course
      // Group sessions (studentId = null): only for enrolled courses + matching shift
      let studentSessionWhere;
      if (studentShift) {
        studentSessionWhere = {
          ...sessionWhere,
          [Op.or]: [
            { studentId: userId },
            {
              [Op.and]: [
                { studentId: null },
                { courseId: courseIdFilter },
                { [Op.or]: [{ shift: studentShift }, { shift: null }] },
              ],
            },
          ],
        };
      } else {
        // No shift assigned: show personal sessions + enrolled-course group sessions (any shift)
        studentSessionWhere = {
          ...sessionWhere,
          [Op.or]: [
            { studentId: userId },
            { [Op.and]: [{ studentId: null }, { courseId: courseIdFilter }] },
          ],
        };
      }

      sessions = await ClassSession.findAll({
        where: studentSessionWhere,
        include: [
          { model: ClassSchedule, as: 'schedule', attributes: ['status', 'meetingLink', 'createdBy'] },
          { model: Courses, foreignKey: 'courseId', attributes: ['id', 'courseName'] },
          { model: Teacher, foreignKey: 'teacherId', attributes: ['id', 'firstName', 'lastName', 'imageUrl'] },
          { model: Student, foreignKey: 'studentId', attributes: ['id', 'firstName', 'lastName'] },
        ],
        order: [['date', 'ASC']],
      });
    } else if (role === 'parent') {
      // Find all children of this parent (with their shift)
      const children = await Student.findAll({
        where: { parentId: userId },
        attributes: ['id', 'firstName', 'lastName', 'shift'],
      });

      if (children.length === 0) {
        sessions = [];
      } else {
        // Fetch each child's enrolled courses in parallel
        const childEnrollments = await Promise.all(
          children.map(async (child) => {
            const cds = await CourseDetails.findAll({ where: { studentId: child.id }, attributes: ['courseId'] });
            return { child, courseIds: cds.map((cd) => cd.courseId) };
          })
        );

        // Personal sessions for each child: always visible
        const childPersonal = children.map((c) => ({ studentId: c.id }));

        // Group sessions: per child — enrolled courses only + matching shift
        const groupConditions = [];
        for (const { child, courseIds } of childEnrollments) {
          const childCourseFilter = courseIds.length > 0 ? { [Op.in]: courseIds } : { [Op.eq]: -1 };
          if (child.shift) {
            groupConditions.push({
              [Op.and]: [
                { studentId: null },
                { courseId: childCourseFilter },
                { [Op.or]: [{ shift: child.shift }, { shift: null }] },
              ],
            });
          } else {
            // Child has no shift: can see enrolled-course group sessions of any shift
            groupConditions.push({
              [Op.and]: [{ studentId: null }, { courseId: childCourseFilter }],
            });
          }
        }

        const parentSessionWhere = {
          ...sessionWhere,
          [Op.or]: [...childPersonal, ...groupConditions],
        };

        sessions = await ClassSession.findAll({
          where: parentSessionWhere,
          include: [
            { model: ClassSchedule, as: 'schedule', attributes: ['status', 'meetingLink', 'createdBy'] },
            { model: Courses, foreignKey: 'courseId', attributes: ['id', 'courseName'] },
            { model: Teacher, foreignKey: 'teacherId', attributes: ['id', 'firstName', 'lastName', 'imageUrl'] },
            { model: Student, foreignKey: 'studentId', attributes: ['id', 'firstName', 'lastName'] },
          ],
          order: [['date', 'ASC']],
        });
      }
    }

    // Format sessions into FullCalendar events
    for (const session of sessions) {
      const scheduleStatus = session.schedule ? session.schedule.status : 'active';
      const teacher = session.Teacher || null;
      const course = session.Course || null;
      const student = session.Student || null;
      events.push(formatSessionEvent(session, scheduleStatus, teacher, course, student, userTz));
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
        { model: Student, foreignKey: 'studentId', attributes: ['id', 'firstName', 'lastName'] },
      ],
    });

    if (!session) return res.status(404).json({ message: 'Session not found' });

    // Authorization check
    if (role === 'teacher' && String(session.teacherId) !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized for this session' });
    }
    if (role === 'student') {
      // Allow if this is a personal session for this student, OR a group session (studentId=null)
      const isPersonalSession = session.studentId !== null;
      if (isPersonalSession && String(session.studentId) !== String(userId)) {
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
      // For group sessions session.Student is null (no specific student tied to the session).
      // Always look up the actual requesting student by userId so every participant
      // gets their real name — prevents all students falling back to "Participant"
      // which causes username-collision errors in MiroTalk.
      const requestingStudent = session.Student || await Student.findByPk(userId, { attributes: ['firstName', 'lastName'] });
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
      return res.status(403).json({ message: 'Only teachers and admins can end a session' });
    }

    const session = await ClassSession.findByPk(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (role === 'teacher' && String(session.teacherId) !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized for this session' });
    }

    // Mark both sessionStatus=ended AND status=completed so attendance/reporting works
    await session.update({ sessionStatus: 'ended', status: 'completed' });

    try {
      const ioPromise = socket.getIO();
      if (ioPromise) {
        const io = await ioPromise;
        io.to(`session-${sessionId}`).emit('session:ended', {
          sessionId: Number(sessionId),
          title: session.title,
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
// Admin: edit safe fields of a single session
// PUT /api/class-schedule/sessions/:sessionId
// Allowed only when status=scheduled AND sessionStatus=idle
// ---------------------------------------------------------------------------
exports.updateSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title, date, startTime, endTime, notes, shift, meetingLink, teacherId } = req.body;

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
    const { startDate, endDate, teacherId, courseId, status, shift, sessionStatus } = req.query;

    const where = {};

    if (startDate && endDate) {
      where.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.date = { [Op.gte]: startDate };
    } else if (endDate) {
      where.date = { [Op.lte]: endDate };
    }

    if (teacherId) where.teacherId = teacherId;
    if (courseId) where.courseId = courseId;
    if (status) where.status = status;
    if (shift) where.shift = shift;
    if (sessionStatus) where.sessionStatus = sessionStatus;

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
      ],
      order: [
        ['date', 'ASC'],
        ['startTime', 'ASC'],
      ],
    });

    // Attach enrolled students for each session via CourseDetails (by courseId only).
    // We intentionally do NOT filter by teacherId here so that students remain visible
    // even after a teacher is reassigned — the enrollment (CourseDetails) still points
    // to the original teacher, but the session's teacherId has changed.
    const courseIds = [...new Set(sessions.map((s) => s.courseId))];
    let studentMap = {};
    if (courseIds.length > 0) {
      const enrollments = await CourseDetails.findAll({
        where: { courseId: courseIds },
        include: [{ model: Student, attributes: ['id', 'firstName', 'lastName', 'profileImg'] }],
        attributes: ['id', 'courseId'],
      });
      enrollments.forEach((cd) => {
        if (!cd.Student) return;
        const key = String(cd.courseId);
        if (!studentMap[key]) studentMap[key] = [];
        // Deduplicate — same student may have multiple CourseDetails rows
        if (!studentMap[key].find((s) => s.id === cd.Student.id)) {
          studentMap[key].push(cd.Student);
        }
      });
    }

    const result = sessions.map((s) => ({
      ...s.toJSON(),
      students: studentMap[String(s.courseId)] || [],
    }));

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
