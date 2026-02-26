const { Op } = require('sequelize');
const ClassSchedule = require('../models/ClassSchedule');
const ClassSession = require('../models/ClassSession');
const Courses = require('../models/Course');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Quiz = require('../models/Quiz/Quiz');
const Assignment = require('../models/Assignment/Assignment');
const CourseDetails = require('../models/CourseDetails');
const callingAppService = require('../services/callingAppService');
const socket = require('../socket');

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
      meetingLink, courseId, teacherId, studentId, courseDetailsId,
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
      meetingLink, courseId, teacherId, studentId, courseDetailsId,
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
    });
    await proposedSession.update({ roomId: `lms-${proposedSession.id}` });

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
    const { reason } = req.body;
    const schedule = await ClassSchedule.findByPk(id);
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });

    await schedule.update({ status: 'cancelled' });

    // Cancel all future sessions
    const today = new Date().toISOString().slice(0, 10);
    await ClassSession.update(
      { status: 'cancelled', cancellationReason: reason || 'Schedule cancelled by admin' },
      { where: { scheduleId: id, date: { [Op.gte]: today }, status: 'scheduled' } }
    );

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
    const { reason } = req.body;

    const session = await ClassSession.findByPk(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    await session.update({
      status: 'cancelled',
      cancellationReason: reason || 'Cancelled',
    });

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
function formatSessionEvent(session, scheduleStatus, teacher, course, student) {
  // Determine effective status for color
  const effectiveStatus = session.status === 'scheduled' && scheduleStatus === 'pending'
    ? 'pending'
    : session.status;

  // Live sessions override the color regardless of attendance status
  const isLive = session.sessionStatus === 'live';
  const color = isLive
    ? SESSION_COLORS.live
    : (SESSION_COLORS[effectiveStatus] || SESSION_COLORS.scheduled);

  const meetingLink = session.meetingLink || (session.schedule ? session.schedule.meetingLink : null);

  return {
    id: `session-${session.id}`,
    title: session.title,
    start: `${session.date}T${session.startTime}`,
    end: `${session.date}T${session.endTime}`,
    backgroundColor: color,
    borderColor: color,
    classNames: isLive ? ['event-live'] : [],
    extendedProps: {
      type: 'class',
      status: effectiveStatus,
      sessionStatus: session.sessionStatus || 'idle',
      sessionId: session.id,
      scheduleId: session.scheduleId,
      roomId: session.roomId || null,
      meetingLink,
      courseName: course ? course.courseName : null,
      teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : null,
      teacherImageUrl: teacher ? teacher.imageUrl : null,
      studentName: student ? `${student.firstName} ${student.lastName}` : null,
      cancellationReason: session.cancellationReason || null,
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
    const { userId, role, start, end } = req.query;
    if (!userId || !role) {
      return res.status(400).json({ message: 'userId and role are required' });
    }

    const dateFilter = {};
    if (start) dateFilter[Op.gte] = start;
    if (end) dateFilter[Op.lte] = end;
    const sessionWhere = Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {};

    const events = [];

    // -----------------------------------------------------------------------
    // Fetch sessions based on role
    // -----------------------------------------------------------------------
    let sessions = [];

    if (role === 'admin') {
      sessions = await ClassSession.findAll({
        where: sessionWhere,
        include: [
          { model: ClassSchedule, as: 'schedule', attributes: ['status', 'meetingLink', 'createdBy'] },
          { model: Courses, foreignKey: 'courseId', attributes: ['id', 'courseName'] },
          { model: Teacher, foreignKey: 'teacherId', attributes: ['id', 'firstName', 'lastName', 'imageUrl'] },
          { model: Student, foreignKey: 'studentId', attributes: ['id', 'firstName', 'lastName'] },
        ],
        order: [['date', 'ASC']],
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
      sessions = await ClassSession.findAll({
        where: { ...sessionWhere, studentId: userId },
        include: [
          { model: ClassSchedule, as: 'schedule', attributes: ['status', 'meetingLink', 'createdBy'] },
          { model: Courses, foreignKey: 'courseId', attributes: ['id', 'courseName'] },
          { model: Teacher, foreignKey: 'teacherId', attributes: ['id', 'firstName', 'lastName', 'imageUrl'] },
          { model: Student, foreignKey: 'studentId', attributes: ['id', 'firstName', 'lastName'] },
        ],
        order: [['date', 'ASC']],
      });
    } else if (role === 'parent') {
      // Find all students linked to this parent
      const children = await Student.findAll({
        where: { parentId: userId },
        attributes: ['id', 'firstName', 'lastName'],
      });
      const childIds = children.map((c) => c.id);
      sessions = await ClassSession.findAll({
        where: { ...sessionWhere, studentId: { [Op.in]: childIds } },
        include: [
          { model: ClassSchedule, as: 'schedule', attributes: ['status', 'meetingLink', 'createdBy'] },
          { model: Courses, foreignKey: 'courseId', attributes: ['id', 'courseName'] },
          { model: Teacher, foreignKey: 'teacherId', attributes: ['id', 'firstName', 'lastName', 'imageUrl'] },
          { model: Student, foreignKey: 'studentId', attributes: ['id', 'firstName', 'lastName'] },
        ],
        order: [['date', 'ASC']],
      });
    }

    // Format sessions into FullCalendar events
    for (const session of sessions) {
      const scheduleStatus = session.schedule ? session.schedule.status : 'active';
      const teacher = session.Teacher || null;
      const course = session.Course || null;
      const student = session.Student || null;
      events.push(formatSessionEvent(session, scheduleStatus, teacher, course, student));
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
      if (String(session.studentId) !== String(userId)) {
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
    } else if (role === 'student' && session.Student) {
      userName = `${session.Student.firstName} ${session.Student.lastName}`;
    } else if (role === 'admin') {
      userName = 'Admin';
    }

    const joinUrl = await callingAppService.createJoinUrl(session.roomId, userName, isPresenter);

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

    await session.update({ sessionStatus: 'live' });

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
          roomId: session.roomId,
        });
      }
    } catch (socketErr) {
      console.error('Socket emit error (non-fatal):', socketErr.message);
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
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ message: 'Only teachers and admins can end a session' });
    }

    const session = await ClassSession.findByPk(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (role === 'teacher' && String(session.teacherId) !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized for this session' });
    }

    await session.update({ sessionStatus: 'ended' });

    try {
      const ioPromise = socket.getIO();
      if (ioPromise) {
        const io = await ioPromise;
        io.to(`session-${sessionId}`).emit('session:ended', {
          sessionId: Number(sessionId),
        });
      }
    } catch (socketErr) {
      console.error('Socket emit error (non-fatal):', socketErr.message);
    }

    return res.json({ message: 'Session ended', sessionStatus: 'ended' });
  } catch (err) {
    console.error('endSession error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};
