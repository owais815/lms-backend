// Run order: 6th — seeds teacher and student attendance for the past 30 days
// Usage: node seeders/06-seed-attendance.js  (from /var/www/lms-backend)

require('./models/association');
const sequelize         = require('./utils/database');
const Teacher           = require('./models/Teacher');
const Student           = require('./models/Student');
const CourseDetails     = require('./models/CourseDetails');
const TeacherAttendance = require('./models/TeacherAttendance');
const Attendance        = require('./models/Attendance');

const dateStr = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

const timeStr = (h, m = 0) => `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
const rnd     = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Skip Fridays (day 5) — weekly off
const isWeeklyOff = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.getDay() === 5;
};

async function seed() {
  await sequelize.authenticate();

  const teachers    = await Teacher.findAll({ where: { username: ['hafiz.rahman','qari.yusuf','ustadha.fatima','maulana.omar','ustadha.aisha','james.mitchell','sarah.thompson'] } });
  const students    = await Student.findAll();
  const cdList      = await CourseDetails.findAll();

  // ── Teacher Attendance — past 30 days ─────────────────────────────────────
  let tCount = 0;
  for (const teacher of teachers) {
    for (let d = 30; d >= 1; d--) {
      if (isWeeklyOff(d)) continue;
      const date = dateStr(d);

      // 90% present, 10% absent
      const isPresent = Math.random() > 0.10;
      const status    = isPresent ? 'Present' : 'Absent';

      // Stagger check-in times realistically (08:00–09:00 with occasional lateness)
      const checkInH = isPresent ? rnd(7, 9) : null;
      const checkInM = isPresent ? rnd(0, 30) : null;
      const checkOutH = isPresent ? rnd(16, 18) : null;

      const [, isNew] = await TeacherAttendance.findOrCreate({
        where: { teacherId: teacher.id, date },
        defaults: {
          teacherId   : teacher.id,
          date,
          status,
          checkInTime : isPresent ? timeStr(checkInH, checkInM) : null,
          checkOutTime: isPresent ? timeStr(checkOutH, rnd(0, 30)) : null,
          notes       : !isPresent ? pick(['Personal leave', 'Medical appointment', 'Family emergency', null]) : null,
        }
      });
      if (isNew) tCount++;
    }
  }
  console.log('✔ Teacher attendance records:', tCount);

  // ── Student Attendance — past 30 days ─────────────────────────────────────
  let sCount = 0;
  for (const cd of cdList) {
    for (let d = 30; d >= 1; d--) {
      if (isWeeklyOff(d)) continue;
      const date = dateStr(d);

      // 85% present, 15% absent
      const isPresent = Math.random() > 0.15;

      const [, isNew] = await Attendance.findOrCreate({
        where: { studentId: cd.studentId, courseDetailsId: cd.id, date },
        defaults: {
          studentId      : cd.studentId,
          courseDetailsId: cd.id,
          date,
          status         : isPresent ? 'Present' : 'Absent',
        }
      });
      if (isNew) sCount++;
    }
  }
  console.log('✔ Student attendance records:', sCount);

  console.log('\n✅  Attendance seed complete.\n');
  process.exit(0);
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

seed().catch(e => { console.error('\n❌', e.message, '\n', e.stack); process.exit(1); });
