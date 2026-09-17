const { Op } = require('sequelize');
const LeaveNotice = require('../models/LeaveNotice');
const ClassSession = require('../models/ClassSession');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const notify = require('../utils/notify');
const { sendEmailEvent } = require("../emails");
const notifyAdmins = require('../utils/notifyAdmins');
const {
    findSessionsForStudent,
    notifyStudentsAndParents,
    displayName,
} = require('../utils/notifyAudience');

const dateRangeWhere = (startDate, endDate) => ({
    [Op.gte]: startDate,
    [Op.lte]: endDate || startDate,
});

// GET /api/leave — Admin: list logged leaves (optional ?personId=&personType=)
exports.getLeaves = async (req, res) => {
    try {
        const where = {};
        if (req.query.personId) where.personId = req.query.personId;
        if (req.query.personType) where.personType = req.query.personType;
        const leaves = await LeaveNotice.findAll({ where, order: [['startDate', 'DESC']] });
        res.json({ leaves });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/leave — Admin/team logs a leave and notifies whoever needs to know
exports.logLeave = async (req, res) => {
    try {
        const { personId, personType, startDate, endDate, reason } = req.body;
        if (!personId || !['teacher', 'student'].includes(personType) || !startDate) {
            return res.status(422).json({ message: 'personId, personType (teacher|student) and startDate are required' });
        }

        const leave = await LeaveNotice.create({
            personId, personType, startDate, endDate: endDate || null, reason: reason || null,
            createdById: req.userId || null,
        });

        const range = dateRangeWhere(startDate, endDate);

        if (personType === 'teacher') {
            const sessions = await ClassSession.findAll({
                where: { teacherId: personId, status: 'scheduled', date: range },
                include: [{ model: Student, attributes: ['id', 'parentId'] }],
            });
            const teacher = await Teacher.findByPk(personId, { attributes: ['firstName', 'lastName'] });
            const teacherName = displayName(teacher, 'Your teacher');

            await Promise.all(sessions.map(async (session) => {
                if (!session.Student) return;
                await notifyStudentsAndParents({
                    students: [session.Student],
                    title: 'Teacher on Leave',
                    message: `${teacherName} is on leave on ${session.date}; a substitute may be assigned — check your schedule.`,
                    parentMessage: `${teacherName} is on leave on ${session.date}; a substitute may be assigned for your child's class.`,
                    emailEvent: 'leave.teacher_logged',
                    emailContext: {
                        leave, teacher, teacherId: personId, affectedSessions: sessions.length,
                    },
                });
            }));

            if (sessions.length > 0) {
                await notifyAdmins({
                    title: 'Teacher on Leave — Reassignment Needed',
                    message: `${teacherName} is on leave ${startDate}${endDate ? ` to ${endDate}` : ''} — ${sessions.length} session(s) need a substitute teacher.`,
                    priority: 'warning',
                });
            }
        } else {
            const sessions = await findSessionsForStudent(personId, {
                status: 'scheduled',
                date: range,
            });
            const student = await Student.findByPk(personId, { attributes: ['firstName', 'lastName', 'parentId'] });
            const studentName = displayName(student, 'A student');

            const teacherIds = [...new Set(sessions.map((s) => s.teacherId).filter(Boolean))];
            await Promise.all(teacherIds.map((teacherId) => notify({
                userId: teacherId,
                userType: 'teacher',
                title: 'Student on Leave',
                message: `${studentName} is on leave ${startDate}${endDate ? ` to ${endDate}` : ''} — sessions may need rescheduling.`,
            })));

            if (student?.parentId) {
                await notify({
                    userId: student.parentId,
                    userType: 'parent',
                    title: 'Leave Noted',
                    message: `We've noted ${studentName}'s leave from ${startDate}${endDate ? ` to ${endDate}` : ''}.`,
                });
                sendEmailEvent('leave.student_logged', {
                    leave,
                    student,
                    studentId: personId,
                    teachers: teacherIds.map((id) => ({ id })),
                    affectedSessions: sessions.length,
                });
            }

            if (sessions.length > 0) {
                await notifyAdmins({
                    title: 'Student on Leave',
                    message: `${studentName} is on leave ${startDate}${endDate ? ` to ${endDate}` : ''} — ${sessions.length} session(s) may need rescheduling.`,
                });
            }
        }

        res.status(201).json({ leave });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
