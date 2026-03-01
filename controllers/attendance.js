const { Op } = require('sequelize');
const { validationResult } = require('express-validator');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const CourseDetails = require('../models/CourseDetails');
const Courses = require('../models/Course');
const ClassSession = require('../models/ClassSession');
const Teacher = require('../models/Teacher');

// ─── Mark single attendance (legacy endpoint, kept for backward compat) ───────
exports.markAttendance = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { studentId, courseDetailsId, date, status = 'Present', sessionId } = req.body;

    let attendance = await Attendance.findOne({
      where: {
        studentId,
        courseDetailsId,
        date,
        ...(sessionId ? { sessionId } : {})
      }
    });

    if (attendance) {
      attendance.status = status;
      if (sessionId) attendance.sessionId = sessionId;
      await attendance.save();
      return res.status(200).json({
        message: 'Attendance record updated successfully',
        attendance,
        recordUpdated: true
      });
    } else {
      attendance = await Attendance.create({
        studentId,
        courseDetailsId,
        date,
        status,
        sessionId: sessionId || null
      });
      return res.status(201).json({
        message: 'Attendance marked successfully',
        attendance,
        recordUpdated: false
      });
    }
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

// ─── Bulk mark attendance for a session ───────────────────────────────────────
exports.bulkMarkAttendance = async (req, res, next) => {
  try {
    const { sessionId, records } = req.body;

    if (!sessionId || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'sessionId and records array are required' });
    }

    const session = await ClassSession.findByPk(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const results = await Promise.all(
      records.map(async ({ studentId, courseDetailsId, status }) => {
        const [record, created] = await Attendance.findOrCreate({
          where: { studentId, sessionId },
          defaults: {
            studentId,
            courseDetailsId: courseDetailsId || null,
            sessionId,
            date: session.date,
            status: status || 'Present'
          }
        });
        if (!created) {
          record.status = status || record.status;
          if (courseDetailsId) record.courseDetailsId = courseDetailsId;
          await record.save();
        }
        return record;
      })
    );

    return res.status(200).json({
      message: `Attendance marked for ${results.length} student(s)`,
      count: results.length
    });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

// ─── Get session attendance sheet (students + existing status) ────────────────
exports.getSessionAttendanceSheet = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await ClassSession.findByPk(sessionId, {
      include: [
        { model: Courses, attributes: ['id', 'courseName'] },
        { model: Teacher, attributes: ['id', 'firstName', 'lastName'] }
      ]
    });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Get all students enrolled in this course under this teacher
    const whereClause = {
      courseId: session.courseId,
      teacherId: session.teacherId
    };
    // If session is for a specific student, only include that student
    if (session.studentId) {
      whereClause.studentId = session.studentId;
    }

    const enrolledDetails = await CourseDetails.findAll({
      where: whereClause,
      include: [
        { model: Student, attributes: ['id', 'firstName', 'lastName', 'profileImg'] }
      ]
    });

    // Get existing attendance records for this session
    const existingAttendance = await Attendance.findAll({
      where: { sessionId }
    });
    const attendanceMap = {};
    existingAttendance.forEach(a => {
      attendanceMap[a.studentId] = a.status;
    });

    const students = enrolledDetails.map(cd => ({
      studentId: cd.Student.id,
      courseDetailsId: cd.id,
      firstName: cd.Student.firstName,
      lastName: cd.Student.lastName,
      profileImg: cd.Student.profileImg || null,
      status: attendanceMap[cd.Student.id] || null
    }));

    return res.status(200).json({
      session: {
        id: session.id,
        title: session.title,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        course: session.Course,
        teacher: session.Teacher
      },
      students
    });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

// ─── Get teacher's sessions for attendance dropdown ───────────────────────────
exports.getTeacherSessions = async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const today = new Date();
    const past30 = new Date(today);
    past30.setDate(today.getDate() - 30);
    const next14 = new Date(today);
    next14.setDate(today.getDate() + 14);

    const sessions = await ClassSession.findAll({
      where: {
        teacherId,
        date: { [Op.between]: [past30.toISOString().split('T')[0], next14.toISOString().split('T')[0]] },
        status: { [Op.in]: ['scheduled', 'completed', 'makeup'] }
      },
      include: [
        { model: Courses, attributes: ['id', 'courseName'] }
      ],
      order: [['date', 'DESC'], ['startTime', 'DESC']]
    });

    return res.status(200).json({ sessions });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

// ─── Get student attendance summary (% per course) ────────────────────────────
exports.getStudentAttendanceSummary = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const records = await Attendance.findAll({
      where: { studentId },
      include: [
        {
          model: CourseDetails,
          include: [{ model: Courses, attributes: ['id', 'courseName'] }]
        }
      ]
    });

    // Group by courseDetailsId
    const grouped = {};
    records.forEach(r => {
      const cdId = r.courseDetailsId;
      if (!cdId) return;
      if (!grouped[cdId]) {
        grouped[cdId] = {
          courseDetailsId: cdId,
          courseId: r.CourseDetail?.courseId || null,
          courseName: r.CourseDetail?.Course?.courseName || 'Unknown',
          totalSessions: 0,
          presentCount: 0,
          absentCount: 0
        };
      }
      grouped[cdId].totalSessions++;
      if (r.status === 'Present') grouped[cdId].presentCount++;
      else grouped[cdId].absentCount++;
    });

    const summaries = Object.values(grouped).map(s => ({
      ...s,
      percentage: s.totalSessions > 0
        ? Math.round((s.presentCount / s.totalSessions) * 100)
        : 0
    }));

    return res.status(200).json({ summaries });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

// ─── Get student full attendance history ──────────────────────────────────────
exports.getStudentAttendance = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate, courseDetailsId } = req.query;

    const where = { studentId };
    if (startDate && endDate) {
      where.date = { [Op.between]: [startDate, endDate] };
    }
    if (courseDetailsId) {
      where.courseDetailsId = courseDetailsId;
    }

    const attendance = await Attendance.findAll({
      where,
      include: [
        {
          model: CourseDetails,
          include: [{ model: Courses, attributes: ['id', 'courseName'] }]
        },
        {
          model: ClassSession,
          attributes: ['id', 'title', 'date', 'startTime', 'endTime']
        }
      ],
      order: [['date', 'DESC']]
    });

    res.status(200).json({ attendance });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

// ─── Get course attendance roster (legacy) ────────────────────────────────────
exports.getCourseAttendance = async (req, res, next) => {
  try {
    const { courseDetailsId } = req.params;
    const attendance = await Attendance.findAll({
      where: { courseDetailsId },
      include: [{ model: Student, attributes: ['id', 'firstName', 'lastName', 'profileImg'] }]
    });
    res.status(200).json({ attendance });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

// ─── Check attendance status (legacy) ─────────────────────────────────────────
exports.checkAttendanceStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { studentId, courseDetailsId } = req.body;
    const today = new Date().toISOString().split('T')[0];

    const attendance = await Attendance.findOne({
      where: { studentId, courseDetailsId, date: today }
    });

    if (attendance) {
      return res.status(200).json({
        status: 'present',
        message: 'Attendance for today is marked as present.',
        attendance
      });
    } else {
      return res.status(200).json({
        status: 'absent',
        message: 'No attendance record found for today.'
      });
    }
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

// ─── Admin: get all student attendance with filters ───────────────────────────
exports.getAdminStudentAttendance = async (req, res, next) => {
  try {
    const { startDate, endDate, teacherId, courseId, studentId, page = 1, limit = 50 } = req.query;

    const where = {};
    if (startDate && endDate) {
      where.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.date = { [Op.gte]: startDate };
    } else if (endDate) {
      where.date = { [Op.lte]: endDate };
    }
    if (studentId) {
      where.studentId = studentId;
    }

    const courseDetailsWhere = {};
    if (teacherId) courseDetailsWhere.teacherId = teacherId;
    if (courseId) courseDetailsWhere.courseId = courseId;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: attendance } = await Attendance.findAndCountAll({
      where,
      include: [
        { model: Student, attributes: ['id', 'firstName', 'lastName', 'profileImg'] },
        {
          model: CourseDetails,
          where: Object.keys(courseDetailsWhere).length > 0 ? courseDetailsWhere : undefined,
          include: [
            { model: Courses, attributes: ['id', 'courseName'] },
            { model: Teacher, attributes: ['id', 'firstName', 'lastName'] }
          ]
        },
        {
          model: ClassSession,
          attributes: ['id', 'title', 'startTime', 'endTime'],
          required: false
        }
      ],
      order: [['date', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    const presentCount = attendance.filter(a => a.status === 'Present').length;
    const absentCount = attendance.filter(a => a.status === 'Absent').length;

    return res.status(200).json({
      attendance,
      total: count,
      page: parseInt(page),
      stats: {
        total: count,
        present: presentCount,
        absent: absentCount,
        percentage: count > 0 ? Math.round((presentCount / count) * 100) : 0
      }
    });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};
