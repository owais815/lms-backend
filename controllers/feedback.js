const { Op } = require('sequelize');
const SessionFeedback = require('../models/SessionFeedback');
const ClassSession = require('../models/ClassSession');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Courses = require('../models/Course');

// ---------------------------------------------------------------------------
// Helper: compute average ratings from an array of SessionFeedback instances
// ---------------------------------------------------------------------------
function computeAverage(feedbacks) {
  if (!feedbacks || !feedbacks.length) return null;
  const n = feedbacks.length;
  const avg = (key) =>
    +(feedbacks.reduce((sum, f) => sum + (f[key] || f.dataValues?.[key] || 0), 0) / n).toFixed(2);
  return {
    count: n,
    teachingQuality: avg('teachingQuality'),
    contentClarity: avg('contentClarity'),
    sessionPace: avg('sessionPace'),
    engagement: avg('engagement'),
    overallRating: avg('overallRating'),
  };
}

// ---------------------------------------------------------------------------
// POST /api/session-feedback/session/:sessionId
// Student submits feedback for a session
// ---------------------------------------------------------------------------
const submitFeedback = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { studentId, teachingQuality, contentClarity, sessionPace, engagement, overallRating, comment } = req.body;

    if (!studentId || !teachingQuality || !contentClarity || !sessionPace || !engagement || !overallRating) {
      return res.status(400).json({ message: 'All rating fields are required' });
    }

    const session = await ClassSession.findByPk(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const existing = await SessionFeedback.findOne({ where: { sessionId, studentId } });
    if (existing) {
      return res.status(409).json({ message: 'You have already submitted feedback for this session' });
    }

    const feedback = await SessionFeedback.create({
      sessionId,
      studentId,
      teachingQuality,
      contentClarity,
      sessionPace,
      engagement,
      overallRating,
      comment: comment || null,
    });

    res.status(201).json({ message: 'Feedback submitted successfully', feedback });
  } catch (err) {
    console.error('submitFeedback error:', err);
    res.status(500).json({ message: 'Failed to submit feedback' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/session-feedback/check/:sessionId?studentId=
// Check if a student already submitted feedback for a session
// ---------------------------------------------------------------------------
const checkFeedback = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { studentId } = req.query;
    if (!studentId) return res.status(400).json({ message: 'studentId is required' });

    const existing = await SessionFeedback.findOne({ where: { sessionId, studentId } });
    res.json({ submitted: !!existing });
  } catch (err) {
    console.error('checkFeedback error:', err);
    res.status(500).json({ message: 'Failed to check feedback status' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/session-feedback/session/:sessionId
// Admin: full attributed feedback; Teacher: anonymous (no student names)
// ---------------------------------------------------------------------------
const getSessionFeedback = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userType } = req;
    const isAdmin = userType === 'ADMIN' || userType === 'SUPER_ADMIN';

    const feedbacks = await SessionFeedback.findAll({
      where: { sessionId },
      include: isAdmin
        ? [{ model: Student, attributes: ['id', 'firstName', 'lastName', 'profileImg'] }]
        : [],
      order: [['createdAt', 'DESC']],
    });

    const summary = computeAverage(feedbacks);

    const result = isAdmin
      ? feedbacks.map((f) => f.toJSON())
      : feedbacks.map((f) => {
          const { studentId, ...rest } = f.toJSON();
          return rest;
        });

    res.json({ feedbacks: result, summary });
  } catch (err) {
    console.error('getSessionFeedback error:', err);
    res.status(500).json({ message: 'Failed to fetch session feedback' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/session-feedback/teacher/:teacherId
// Teacher: see anonymous aggregated feedback for their own sessions
// Admin: full details with student names
// ---------------------------------------------------------------------------
const getTeacherFeedback = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { userType } = req;
    const isAdmin = userType === 'ADMIN' || userType === 'SUPER_ADMIN';

    const sessions = await ClassSession.findAll({
      where: { teacherId },
      attributes: ['id', 'title', 'date', 'courseId'],
    });
    const sessionIds = sessions.map((s) => s.id);
    if (!sessionIds.length) return res.json({ feedbacks: [], summary: null, perSession: [] });

    const feedbacks = await SessionFeedback.findAll({
      where: { sessionId: { [Op.in]: sessionIds } },
      include: [
        { model: ClassSession, attributes: ['id', 'title', 'date', 'courseId'] },
        ...(isAdmin
          ? [{ model: Student, attributes: ['id', 'firstName', 'lastName', 'profileImg'] }]
          : []),
      ],
      order: [['createdAt', 'DESC']],
    });

    const overallSummary = computeAverage(feedbacks);

    // Per-session breakdown
    const sessionMap = {};
    sessions.forEach((s) => {
      sessionMap[s.id] = { sessionId: s.id, sessionTitle: s.title, date: s.date, count: 0, feedback: null };
    });
    const sessionFeedbackBuckets = {};
    feedbacks.forEach((f) => {
      if (!sessionFeedbackBuckets[f.sessionId]) sessionFeedbackBuckets[f.sessionId] = [];
      sessionFeedbackBuckets[f.sessionId].push(f);
    });
    const perSession = Object.entries(sessionFeedbackBuckets).map(([sid, fbs]) => ({
      sessionId: Number(sid),
      sessionTitle: sessionMap[sid]?.sessionTitle || '',
      date: sessionMap[sid]?.date || '',
      count: fbs.length,
      feedback: computeAverage(fbs),
    }));

    // Anonymize for teacher view
    const sanitized = isAdmin
      ? feedbacks.map((f) => f.toJSON())
      : feedbacks.map((f) => {
          const json = f.toJSON();
          delete json.studentId;
          delete json.Student;
          return json;
        });

    res.json({ feedbacks: sanitized, summary: overallSummary, perSession });
  } catch (err) {
    console.error('getTeacherFeedback error:', err);
    res.status(500).json({ message: 'Failed to fetch teacher feedback' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/session-feedback/admin/summary
// Admin overview: total stats, per-teacher breakdown, recent feedback list
// ---------------------------------------------------------------------------
const getAdminSummary = async (req, res) => {
  try {
    const feedbacks = await SessionFeedback.findAll({
      include: [
        {
          model: ClassSession,
          attributes: ['id', 'title', 'date', 'teacherId', 'courseId'],
          include: [
            { model: Teacher, attributes: ['id', 'firstName', 'lastName', 'imageUrl'] },
            { model: Courses, attributes: ['id', 'name'] },
          ],
        },
        { model: Student, attributes: ['id', 'firstName', 'lastName', 'profileImg'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    const overallSummary = computeAverage(feedbacks);

    // Group by teacher
    const byTeacher = {};
    feedbacks.forEach((f) => {
      const fj = f.toJSON();
      const tid = fj.ClassSession?.teacherId;
      const teacher = fj.ClassSession?.Teacher;
      const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Unknown';
      if (!byTeacher[tid]) {
        byTeacher[tid] = { teacherId: tid, teacherName, imageUrl: teacher?.imageUrl || null, feedbacks: [] };
      }
      byTeacher[tid].feedbacks.push(fj);
    });

    const teacherSummaries = Object.values(byTeacher).map((t) => ({
      teacherId: t.teacherId,
      teacherName: t.teacherName,
      imageUrl: t.imageUrl,
      ...computeAverage(t.feedbacks),
    }));

    // Sort teachers by overallRating descending
    teacherSummaries.sort((a, b) => (b.overallRating || 0) - (a.overallRating || 0));

    res.json({
      total: feedbacks.length,
      overallSummary,
      teacherSummaries,
      recentFeedbacks: feedbacks.slice(0, 30).map((f) => f.toJSON()),
    });
  } catch (err) {
    console.error('getAdminSummary error:', err);
    res.status(500).json({ message: 'Failed to fetch admin feedback summary' });
  }
};

module.exports = { submitFeedback, checkFeedback, getSessionFeedback, getTeacherFeedback, getAdminSummary };
