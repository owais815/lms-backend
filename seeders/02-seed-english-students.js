// Run order: 2nd — adds English-named teachers (James Mitchell, Sarah Thompson) + 10 English students
// Usage: node seeders/02-seed-english-students.js  (from /var/www/lms-backend)

const bcrypt = require('bcryptjs');
require('./models/association');
const sequelize        = require('./utils/database');
const Teacher          = require('./models/Teacher');
const Student          = require('./models/Student');
const Plan             = require('./models/Plan');
const CourseDetails    = require('./models/CourseDetails');
const EnrolledStudents = require('./models/EnrolledStudents');
const TeacherStudent   = require('./models/TeacherStudent');

const h = (p) => bcrypt.hash(p, 12);

async function run() {
  await sequelize.authenticate();

  const [basic]    = await Plan.findOrCreate({ where: { name: 'Basic' },    defaults: { name: 'Basic',    price: 15, billingCycle: 'monthly', durationDays: 30, description: 'Basic plan', features: [] } });
  const [standard] = await Plan.findOrCreate({ where: { name: 'Standard' }, defaults: { name: 'Standard', price: 25, billingCycle: 'monthly', durationDays: 30, description: 'Standard plan', features: [] } });
  const [premium]  = await Plan.findOrCreate({ where: { name: 'Premium' },  defaults: { name: 'Premium',  price: 40, billingCycle: 'monthly', durationDays: 30, description: 'Premium plan', features: [] } });

  const Course = require('./models/Course');
  const courses = await Course.findAll();
  const nazra    = courses.find(c => c.courseName.includes('Nazra'))    || courses[0];
  const tajweed  = courses.find(c => c.courseName.includes('Tajweed'))  || courses[1];
  const hifz     = courses.find(c => c.courseName.includes('Hifz'))     || courses[2];
  const islamic  = courses.find(c => c.courseName.includes('Islamic'))  || courses[3];
  const arabic   = courses.find(c => c.courseName.includes('Arabic'))   || courses[4];
  const kids     = courses.find(c => c.courseName.includes('Kids'))     || courses[5];

  // ── English teachers ───────────────────────────────────────────────────────
  const newTeachers = [
    { firstName: 'James',  lastName: 'Mitchell', email: 'james.mitchell@mualimulquran.com', username: 'james.mitchell', contact: '+447911100601', cnic: '3520112346001', imageUrl: 'resources/profiles/teacher-m-44.jpg', timeZone: 'Europe/London',    shift: ['Morning','Afternoon'] },
    { firstName: 'Sarah',  lastName: 'Thompson', email: 'sarah.thompson@mualimulquran.com', username: 'sarah.thompson', contact: '+12025550602',  cnic: '3520112346002', imageUrl: 'resources/profiles/teacher-f-22.jpg', timeZone: 'America/New_York', shift: ['Evening'] },
  ];
  const addedTeachers = [];
  for (const t of newTeachers) {
    const [teacher] = await Teacher.findOrCreate({ where: { username: t.username }, defaults: { ...t, password: await h('Teacher@1234') } });
    addedTeachers.push(teacher);
  }
  const jamesMitchell  = addedTeachers[0];
  const sarahThompson  = addedTeachers[1];
  console.log('✔ English teachers');

  // ── English students ───────────────────────────────────────────────────────
  const newStudentData = [
    { firstName: 'Oliver',    lastName: 'Smith',    email: 'oliver.smith@gmail.com',    username: 'oliver.smith',    contact: '+447911100701', countryName: 'United Kingdom', city: 'London',   timeZone: 'Europe/London',      shift: 'Morning',   planId: standard.id, profileImg: 'resources/profiles/student-m-51.jpg', studentLabel: 'New Enrollment', enrollmentChannel: 'Google',    courseId: nazra.id,   teacher: jamesMitchell },
    { firstName: 'Emily',     lastName: 'Johnson',  email: 'emily.johnson@gmail.com',   username: 'emily.johnson',   contact: '+12025550702',  countryName: 'United States',  city: 'Chicago',  timeZone: 'America/Chicago',    shift: 'Evening',   planId: basic.id,    profileImg: 'resources/profiles/student-f-51.jpg', studentLabel: 'Trial',          enrollmentChannel: 'Meta',      courseId: islamic.id, teacher: sarahThompson },
    { firstName: 'William',   lastName: 'Brown',    email: 'william.brown@gmail.com',   username: 'william.brown',   contact: '+61412340703',  countryName: 'Australia',      city: 'Brisbane', timeZone: 'Australia/Brisbane', shift: 'Morning',   planId: premium.id,  profileImg: 'resources/profiles/student-m-52.jpg', studentLabel: 'New Enrollment', enrollmentChannel: 'SEO',       courseId: arabic.id,  teacher: jamesMitchell },
    { firstName: 'Sophie',    lastName: 'Williams', email: 'sophie.williams@gmail.com', username: 'sophie.williams', contact: '+447911100704', countryName: 'United Kingdom', city: 'Edinburgh',timeZone: 'Europe/London',      shift: 'Afternoon', planId: standard.id, profileImg: 'resources/profiles/student-f-52.jpg', studentLabel: 'New Enrollment', enrollmentChannel: 'Reference', courseId: tajweed.id, teacher: jamesMitchell },
    { firstName: 'Liam',      lastName: 'Davis',    email: 'liam.davis@gmail.com',      username: 'liam.davis',      contact: '+16135550705',  countryName: 'Canada',         city: 'Montreal', timeZone: 'America/Montreal',   shift: 'Evening',   planId: basic.id,    profileImg: 'resources/profiles/student-m-53.jpg', studentLabel: 'Trial',          enrollmentChannel: 'TikTok',    courseId: kids.id,    teacher: sarahThompson },
    { firstName: 'Charlotte', lastName: 'Wilson',   email: 'charlotte.wilson@gmail.com',username: 'charlotte.wilson',contact: '+12135550706',  countryName: 'United States',  city: 'Houston',  timeZone: 'America/Chicago',    shift: 'Morning',   planId: premium.id,  profileImg: 'resources/profiles/student-f-53.jpg', studentLabel: 'New Enrollment', enrollmentChannel: 'Google',    courseId: hifz.id,    teacher: sarahThompson },
    { firstName: 'Noah',      lastName: 'Taylor',   email: 'noah.taylor@gmail.com',     username: 'noah.taylor',     contact: '+971501230707', countryName: 'UAE',            city: 'Dubai',    timeZone: 'Asia/Dubai',         shift: 'Afternoon', planId: standard.id, profileImg: 'resources/profiles/student-m-54.jpg', studentLabel: 'New Enrollment', enrollmentChannel: 'Email',     courseId: nazra.id,   teacher: jamesMitchell },
    { firstName: 'Amelia',    lastName: 'Anderson', email: 'amelia.anderson@gmail.com', username: 'amelia.anderson', contact: '+447911100708', countryName: 'United Kingdom', city: 'Bristol',  timeZone: 'Europe/London',      shift: 'Morning',   planId: basic.id,    profileImg: 'resources/profiles/student-f-54.jpg', studentLabel: 'Trial',          enrollmentChannel: 'Meta',      courseId: islamic.id, teacher: sarahThompson },
    { firstName: 'George',    lastName: 'Martin',   email: 'george.martin@gmail.com',   username: 'george.martin',   contact: '+61412340709', countryName: 'Australia',      city: 'Perth',    timeZone: 'Australia/Perth',    shift: 'Evening',   planId: premium.id,  profileImg: 'resources/profiles/student-m-55.jpg', studentLabel: 'New Enrollment', enrollmentChannel: 'Reference', courseId: arabic.id,  teacher: jamesMitchell },
    { firstName: 'Isabella',  lastName: 'Clark',    email: 'isabella.clark@gmail.com',  username: 'isabella.clark',  contact: '+16045550710', countryName: 'Canada',         city: 'Calgary',  timeZone: 'America/Edmonton',   shift: 'Morning',   planId: standard.id, profileImg: 'resources/profiles/student-f-55.jpg', studentLabel: 'New Enrollment', enrollmentChannel: 'Google',    courseId: tajweed.id, teacher: sarahThompson },
  ];

  for (const s of newStudentData) {
    const { courseId, teacher, ...studentFields } = s;
    const [student] = await Student.findOrCreate({ where: { username: studentFields.username }, defaults: { ...studentFields, password: await h('Student@1234') } });
    await CourseDetails.findOrCreate({ where: { studentId: student.id, courseId }, defaults: { teacherId: teacher.id, studentId: student.id, courseId } });
    await EnrolledStudents.findOrCreate({ where: { studentId: student.id, courseId }, defaults: { studentId: student.id, courseId } });
    await TeacherStudent.findOrCreate({ where: { TeacherId: teacher.id, StudentId: student.id }, defaults: { TeacherId: teacher.id, StudentId: student.id } });
  }
  console.log('✔ English students with enrollments & teacher assignments');

  console.log('\n✅  All done.\n');
  process.exit(0);
}

run().catch(e => { console.error('\n❌ Failed:', e.message, e); process.exit(1); });
