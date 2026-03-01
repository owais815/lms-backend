const { Op } = require('sequelize');
const TeacherAttendance = require('../models/TeacherAttendance');
const Teacher = require('../models/Teacher');

// ─── Check In ─────────────────────────────────────────────────────────────────
exports.checkIn = async (req, res, next) => {
  try {
    const { teacherId, notes } = req.body;

    if (!teacherId) {
      return res.status(400).json({ message: 'teacherId is required' });
    }

    const teacher = await Teacher.findByPk(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().split(' ')[0]; // HH:MM:SS

    const [record, created] = await TeacherAttendance.findOrCreate({
      where: { teacherId, date: today },
      defaults: {
        teacherId,
        date: today,
        checkInTime: now,
        status: 'Present',
        notes: notes || null
      }
    });

    if (!created) {
      // Already checked in today — update check-in time
      record.checkInTime = now;
      record.status = 'Present';
      if (notes) record.notes = notes;
      await record.save();
    }

    return res.status(created ? 201 : 200).json({
      message: created ? 'Checked in successfully' : 'Check-in time updated',
      record
    });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

// ─── Check Out ────────────────────────────────────────────────────────────────
exports.checkOut = async (req, res, next) => {
  try {
    const { teacherId } = req.body;

    if (!teacherId) {
      return res.status(400).json({ message: 'teacherId is required' });
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().split(' ')[0]; // HH:MM:SS

    const record = await TeacherAttendance.findOne({
      where: { teacherId, date: today }
    });

    if (!record) {
      return res.status(400).json({ message: 'You have not checked in today. Please check in first.' });
    }

    record.checkOutTime = now;
    await record.save();

    return res.status(200).json({
      message: 'Checked out successfully',
      record
    });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

// ─── Get today's attendance record for a teacher ──────────────────────────────
exports.getToday = async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const today = new Date().toISOString().split('T')[0];

    const record = await TeacherAttendance.findOne({
      where: { teacherId, date: today }
    });

    return res.status(200).json({ record: record || null });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

// ─── Get attendance history for a teacher ─────────────────────────────────────
exports.getHistory = async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const { startDate, endDate, page = 1, limit = 30 } = req.query;

    const where = { teacherId };

    if (startDate && endDate) {
      where.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.date = { [Op.gte]: startDate };
    } else if (endDate) {
      where.date = { [Op.lte]: endDate };
    } else {
      // Default: last 30 days
      const past30 = new Date();
      past30.setDate(past30.getDate() - 30);
      where.date = { [Op.gte]: past30.toISOString().split('T')[0] };
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: records } = await TeacherAttendance.findAndCountAll({
      where,
      order: [['date', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    return res.status(200).json({ records, total: count, page: parseInt(page) });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

// ─── Admin: overview of all teacher attendance ────────────────────────────────
exports.adminOverview = async (req, res, next) => {
  try {
    const { startDate, endDate, teacherId, page = 1, limit = 50 } = req.query;

    const where = {};

    if (startDate && endDate) {
      where.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.date = { [Op.gte]: startDate };
    } else if (endDate) {
      where.date = { [Op.lte]: endDate };
    }

    if (teacherId) {
      where.teacherId = teacherId;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: records } = await TeacherAttendance.findAndCountAll({
      where,
      include: [
        { model: Teacher, attributes: ['id', 'firstName', 'lastName', 'imageUrl'] }
      ],
      order: [['date', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    const presentCount = records.filter(r => r.status === 'Present').length;
    const absentCount = records.filter(r => r.status === 'Absent').length;

    return res.status(200).json({
      records,
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
