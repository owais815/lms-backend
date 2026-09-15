const cron = require('node-cron');
const CourseDetails = require('../models/CourseDetails');
const WeeklyContent = require('../models/WeeklyContent');
const WeeklyResource = require('../models/WeeklyResources');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Courses = require('../models/Course');
const notifyAdmins = require('../utils/notifyAdmins');

const GRACE_DAYS_INTO_WEEK = 3; // give the teacher a few days into the week before flagging
const alertedWeeks = new Set(); // in-memory dedup, keyed `${courseDetailId}:${weekNumber}` — resets on restart (acceptable)

function weeksElapsed(startDateStr, today) {
    const start = new Date(startDateStr);
    const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return null; // enrollment hasn't started yet
    return { currentWeek: Math.floor(diffDays / 7) + 1, dayIntoWeek: (diffDays % 7) + 1 };
}

async function checkMissingLessons() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const enrollments = await CourseDetails.findAll({
            where: { status: 'active' },
            include: [
                { model: Teacher, attributes: ['id', 'firstName', 'lastName'] },
                { model: Student, attributes: ['id', 'firstName', 'lastName'] },
                { model: Courses, attributes: ['courseName'] },
            ],
        });

        for (const enrollment of enrollments) {
            if (!enrollment.startDate || !enrollment.teacherId) continue;

            const progress = weeksElapsed(enrollment.startDate, today);
            if (!progress || progress.dayIntoWeek < GRACE_DAYS_INTO_WEEK) continue;

            const key = `${enrollment.id}:${progress.currentWeek}`;
            if (alertedWeeks.has(key)) continue;

            const weeklyContent = await WeeklyContent.findOne({
                where: { courseDetailId: enrollment.id, weekNumber: progress.currentWeek },
                include: [{ model: WeeklyResource, as: 'resources' }],
            });

            if (weeklyContent && weeklyContent.resources?.length > 0) continue;

            alertedWeeks.add(key);
            const teacherName = enrollment.Teacher ? `${enrollment.Teacher.firstName} ${enrollment.Teacher.lastName}` : `Teacher #${enrollment.teacherId}`;
            const studentName = enrollment.Student ? `${enrollment.Student.firstName} ${enrollment.Student.lastName}` : `Student #${enrollment.studentId}`;
            await notifyAdmins({
                title: 'Lesson Content Missing',
                message: `${teacherName} hasn't uploaded Week ${progress.currentWeek} content for ${studentName}'s ${enrollment.Course?.courseName || 'course'} yet.`,
                priority: 'warning',
            });
        }
    } catch (error) {
        console.error('[checkMissingLessons] Error:', error.message);
    }
}

function startMissingLessonsCron() {
    cron.schedule('0 6 * * *', checkMissingLessons); // daily at 06:00
    console.log('[checkMissingLessons] Missing-lessons cron started (runs daily at 06:00).');
}

module.exports = { startMissingLessonsCron };
