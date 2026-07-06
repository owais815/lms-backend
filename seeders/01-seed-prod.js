// Run order: 1st — seeds plans, courses, teachers, students (Arabic-named), parents, enrollments
// Usage: node seeders/01-seed-prod.js  (from /var/www/lms-backend)

const bcrypt = require('bcryptjs');
require('./models/association');
const sequelize = require('./utils/database');
const Admin       = require('./models/Admin');
const Roles       = require('./models/Roles');
const Plan        = require('./models/Plan');
const Course      = require('./models/Course');
const Teacher     = require('./models/Teacher');
const Student     = require('./models/Student');
const Parent      = require('./models/Parent');
const CourseDetails     = require('./models/CourseDetails');
const EnrolledStudents  = require('./models/EnrolledStudents');

const h = (p) => bcrypt.hash(p, 12);

async function seed() {
  await sequelize.authenticate();
  console.log('Connected.\n');

  // ── Plans ──────────────────────────────────────────────────────────────────
  const plans = await Promise.all([
    Plan.findOrCreate({ where: { name: 'Basic' },    defaults: { name: 'Basic',    price: 15.00, billingCycle: 'monthly', durationDays: 30,  description: 'Perfect for beginners — 3 sessions/week', features: ['3 sessions/week','Quran recitation','Progress reports'] } }),
    Plan.findOrCreate({ where: { name: 'Standard' }, defaults: { name: 'Standard', price: 25.00, billingCycle: 'monthly', durationDays: 30,  description: 'Most popular — 5 sessions/week', features: ['5 sessions/week','Tajweed focus','Monthly assessments','Parent updates'] } }),
    Plan.findOrCreate({ where: { name: 'Premium' },  defaults: { name: 'Premium',  price: 40.00, billingCycle: 'monthly', durationDays: 30,  description: 'Intensive Hifz programme — daily sessions', features: ['Daily sessions','Hifz tracking','1-on-1 teacher','Certificate on completion'] } }),
  ]);
  const [basic, standard, premium] = plans.map(([p]) => p);
  console.log('✔ Plans');

  // ── Courses ────────────────────────────────────────────────────────────────
  const courseData = [
    { courseName: 'Quran Recitation (Nazra)', duration: '3 Months', price: 20, description: 'Learn to read the Quran fluently with proper pronunciation from Surah Al-Fatiha to complete Quran.', imageUrl: 'https://images.unsplash.com/photo-1585036156171-384164a8c675?w=600&q=80' },
    { courseName: 'Tajweed ul Quran',          duration: '4 Months', price: 30, description: 'Master the rules of Tajweed — Makharij, Sifaat, Madd rules and Waqf signs for beautiful recitation.', imageUrl: 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=600&q=80' },
    { courseName: 'Hifz ul Quran',             duration: '24 Months',price: 50, description: 'Complete Quran memorisation programme with daily revision, Sabaq, and Sabqi tracking.', imageUrl: 'https://images.unsplash.com/photo-1593113630400-ea4288922559?w=600&q=80' },
    { courseName: 'Islamic Studies',           duration: '6 Months', price: 25, description: 'Covers Aqeedah, Fiqh, Seerah of the Prophet ﷺ, Islamic history and daily ibadah practices.', imageUrl: 'https://images.unsplash.com/photo-1564769662533-4f00a87b4056?w=600&q=80' },
    { courseName: 'Arabic Language',           duration: '6 Months', price: 35, description: 'Learn Quranic Arabic from scratch — grammar, vocabulary, and sentence construction to understand the Quran directly.', imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80' },
    { courseName: 'Duas & Surahs for Kids',    duration: '2 Months', price: 15, description: 'Fun and engaging programme for children to learn essential duas, short surahs and basic Islamic values.', imageUrl: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=600&q=80' },
  ];
  const courses = [];
  for (const c of courseData) {
    const [course] = await Course.findOrCreate({ where: { courseName: c.courseName }, defaults: c });
    courses.push(course);
  }
  console.log('✔ Courses');

  // ── Teachers ───────────────────────────────────────────────────────────────
  const teacherData = [
    { firstName: 'Hafiz',    lastName: 'Abdul Rahman',  email: 'abdulrahman@mualimulquran.com', username: 'hafiz.rahman',   contact: '+923001234501', cnic: '3520112345001', imageUrl: 'resources/profiles/teacher-m-11.jpg', timeZone: 'Asia/Karachi',     shift: ['Morning','Afternoon'] },
    { firstName: 'Qari',     lastName: 'Yusuf Siddiqui',email: 'yusuf@mualimulquran.com',       username: 'qari.yusuf',     contact: '+923001234502', cnic: '3520112345002', imageUrl: 'resources/profiles/teacher-m-22.jpg', timeZone: 'Asia/Karachi',     shift: ['Afternoon','Evening'] },
    { firstName: 'Ustadha',  lastName: 'Fatima Malik',  email: 'fatima@mualimulquran.com',      username: 'ustadha.fatima', contact: '+923001234503', cnic: '3520112345003', imageUrl: 'resources/profiles/teacher-f-11.jpg', timeZone: 'Europe/London',    shift: ['Morning'] },
    { firstName: 'Maulana',  lastName: 'Omar Farooq',   email: 'omar@mualimulquran.com',        username: 'maulana.omar',   contact: '+923001234504', cnic: '3520112345004', imageUrl: 'resources/profiles/teacher-m-33.jpg', timeZone: 'America/New_York', shift: ['Evening'] },
    { firstName: 'Ustadha',  lastName: 'Aisha Noor',    email: 'aisha@mualimulquran.com',       username: 'ustadha.aisha',  contact: '+923001234505', cnic: '3520112345005', imageUrl: 'resources/profiles/teacher-f-22.jpg', timeZone: 'Australia/Sydney', shift: ['Morning','Evening'] },
  ];
  const teachers = [];
  for (const t of teacherData) {
    const [teacher] = await Teacher.findOrCreate({ where: { username: t.username }, defaults: { ...t, password: await h('Teacher@1234') } });
    teachers.push(teacher);
  }
  console.log('✔ Teachers');

  // ── Students ───────────────────────────────────────────────────────────────
  const studentData = [
    { firstName: 'Muhammad',  lastName: 'Ali',        email: 'muhammadali@gmail.com',    username: 'muhammad.ali',    contact: '+923331112201', countryName: 'Pakistan',       city: 'Lahore',      timeZone: 'Asia/Karachi',        shift: 'Morning',   planId: standard.id, profileImg: 'resources/profiles/student-m-41.jpg', studentLabel: 'New Enrollment', enrollmentChannel: 'Reference' },
    { firstName: 'Zainab',    lastName: 'Khan',       email: 'zainabkhan@gmail.com',     username: 'zainab.khan',     contact: '+447911123402', countryName: 'United Kingdom',  city: 'London',      timeZone: 'Europe/London',       shift: 'Afternoon', planId: basic.id,    profileImg: 'resources/profiles/student-f-41.jpg', studentLabel: 'Trial',          enrollmentChannel: 'Google' },
    { firstName: 'Ibrahim',   lastName: 'Hassan',     email: 'ibrahimhassan@gmail.com',  username: 'ibrahim.hassan',  contact: '+12025551403', countryName: 'United States',   city: 'New York',    timeZone: 'America/New_York',    shift: 'Evening',   planId: premium.id,  profileImg: 'resources/profiles/student-m-42.jpg', studentLabel: 'New Enrollment', enrollmentChannel: 'Meta' },
    { firstName: 'Maryam',    lastName: 'Siddiqui',   email: 'maryams@gmail.com',        username: 'maryam.siddiqui', contact: '+16135551404', countryName: 'Canada',          city: 'Toronto',     timeZone: 'America/Toronto',     shift: 'Morning',   planId: standard.id, profileImg: 'resources/profiles/student-f-42.jpg', studentLabel: 'New Enrollment', enrollmentChannel: 'SEO' },
    { firstName: 'Abdullah',  lastName: 'Ahmed',      email: 'abdullahahmed@gmail.com',  username: 'abdullah.ahmed',  contact: '+61412345405', countryName: 'Australia',       city: 'Sydney',      timeZone: 'Australia/Sydney',    shift: 'Morning',   planId: basic.id,    profileImg: 'resources/profiles/student-m-43.jpg', studentLabel: 'Trial',          enrollmentChannel: 'Google' },
    { firstName: 'Hafsa',     lastName: 'Rahman',     email: 'hafsarahman@gmail.com',    username: 'hafsa.rahman',    contact: '+923331112406', countryName: 'Pakistan',       city: 'Karachi',     timeZone: 'Asia/Karachi',        shift: 'Afternoon', planId: premium.id,  profileImg: 'resources/profiles/student-f-43.jpg', studentLabel: 'New Enrollment', enrollmentChannel: 'Reference' },
    { firstName: 'Yusuf',     lastName: 'Malik',      email: 'yusufmalik@gmail.com',     username: 'yusuf.malik',     contact: '+971501234507', countryName: 'UAE',             city: 'Dubai',       timeZone: 'Asia/Dubai',          shift: 'Evening',   planId: standard.id, profileImg: 'resources/profiles/student-m-44.jpg', studentLabel: 'New Enrollment', enrollmentChannel: 'Meta' },
    { firstName: 'Ruqayyah',  lastName: 'Omar',       email: 'ruqayyah@gmail.com',       username: 'ruqayyah.omar',   contact: '+447911123408', countryName: 'United Kingdom',  city: 'Birmingham',  timeZone: 'Europe/London',       shift: 'Morning',   planId: basic.id,    profileImg: 'resources/profiles/student-f-44.jpg', studentLabel: 'Trial',          enrollmentChannel: 'Email' },
    { firstName: 'Bilal',     lastName: 'Hussain',    email: 'bilalhussain@gmail.com',   username: 'bilal.hussain',   contact: '+923001234509', countryName: 'Pakistan',       city: 'Islamabad',   timeZone: 'Asia/Karachi',        shift: 'Morning',   planId: standard.id, profileImg: 'resources/profiles/student-m-45.jpg', studentLabel: 'New Enrollment', enrollmentChannel: 'Reference' },
    { firstName: 'Safiya',    lastName: 'Iqbal',      email: 'safiyaiqbal@gmail.com',    username: 'safiya.iqbal',    contact: '+16045551410', countryName: 'Canada',          city: 'Vancouver',   timeZone: 'America/Vancouver',   shift: 'Evening',   planId: premium.id,  profileImg: 'resources/profiles/student-f-45.jpg', studentLabel: 'New Enrollment', enrollmentChannel: 'Google' },
    { firstName: 'Hamza',     lastName: 'Farooq',     email: 'hamzafarooq@gmail.com',    username: 'hamza.farooq',    contact: '+923331112411', countryName: 'Pakistan',       city: 'Faisalabad',  timeZone: 'Asia/Karachi',        shift: 'Afternoon', planId: basic.id,    profileImg: 'resources/profiles/student-m-46.jpg', studentLabel: 'Trial',          enrollmentChannel: 'TikTok' },
    { firstName: 'Khadija',   lastName: 'Tariq',      email: 'khadijatariq@gmail.com',   username: 'khadija.tariq',   contact: '+12135551412', countryName: 'United States',   city: 'Los Angeles', timeZone: 'America/Los_Angeles', shift: 'Morning',   planId: standard.id, profileImg: 'resources/profiles/student-f-46.jpg', studentLabel: 'New Enrollment', enrollmentChannel: 'Meta' },
    { firstName: 'Usman',     lastName: 'Sheikh',     email: 'usmansheikh@gmail.com',    username: 'usman.sheikh',    contact: '+971501234513', countryName: 'UAE',             city: 'Abu Dhabi',   timeZone: 'Asia/Dubai',          shift: 'Evening',   planId: premium.id,  profileImg: 'resources/profiles/student-m-47.jpg', studentLabel: 'New Enrollment', enrollmentChannel: 'SEO' },
    { firstName: 'Amina',     lastName: 'Baig',       email: 'aminabaig@gmail.com',      username: 'amina.baig',      contact: '+447911123414', countryName: 'United Kingdom',  city: 'Manchester',  timeZone: 'Europe/London',       shift: 'Afternoon', planId: basic.id,    profileImg: 'resources/profiles/student-f-47.jpg', studentLabel: 'Trial',          enrollmentChannel: 'Google' },
    { firstName: 'Tariq',     lastName: 'Aziz',       email: 'tariqaziz@gmail.com',      username: 'tariq.aziz',      contact: '+61412345415', countryName: 'Australia',       city: 'Melbourne',   timeZone: 'Australia/Melbourne', shift: 'Morning',   planId: standard.id, profileImg: 'resources/profiles/student-m-48.jpg', studentLabel: 'New Enrollment', enrollmentChannel: 'Reference' },
  ];
  const students = [];
  for (const s of studentData) {
    const [student] = await Student.findOrCreate({ where: { username: s.username }, defaults: { ...s, password: await h('Student@1234') } });
    students.push(student);
  }
  console.log('✔ Students (15 Arabic-named)');

  // ── Parents (for students 0-4) ─────────────────────────────────────────────
  const parentData = [
    { firstName: 'Khalid',   lastName: 'Ali',      email: 'khalidali@gmail.com',    username: 'khalid.ali',    contact: '+923331112601', studentIdx: 0 },
    { firstName: 'Nusrat',   lastName: 'Khan',     email: 'nusratkhan@gmail.com',   username: 'nusrat.khan',   contact: '+447911123602', studentIdx: 1 },
    { firstName: 'Yusra',    lastName: 'Hassan',   email: 'yusrahassan@gmail.com',  username: 'yusra.hassan',  contact: '+12025551603', studentIdx: 2 },
    { firstName: 'Salma',    lastName: 'Siddiqui', email: 'salmasiddiqui@gmail.com',username: 'salma.siddiqui',contact: '+16135551604', studentIdx: 3 },
    { firstName: 'Rashid',   lastName: 'Ahmed',    email: 'rashidahmed@gmail.com',  username: 'rashid.ahmed',  contact: '+61412345605', studentIdx: 4 },
  ];
  for (const p of parentData) {
    const { studentIdx, ...fields } = p;
    const [parent] = await Parent.findOrCreate({ where: { username: fields.username }, defaults: { ...fields, password: await h('Parent@1234') } });
    await Student.update({ parentId: parent.id }, { where: { id: students[studentIdx].id } });
  }
  console.log('✔ Parents');

  // ── CourseDetails (teacher-student-course assignments) ─────────────────────
  const assignments = [
    { teacherId: teachers[0].id, studentId: students[0].id,  courseId: courses[1].id },  // Hafiz → Muhammad → Tajweed
    { teacherId: teachers[0].id, studentId: students[5].id,  courseId: courses[2].id },  // Hafiz → Hafsa → Hifz
    { teacherId: teachers[0].id, studentId: students[8].id,  courseId: courses[1].id },  // Hafiz → Bilal → Tajweed
    { teacherId: teachers[1].id, studentId: students[1].id,  courseId: courses[0].id },  // Qari → Zainab → Nazra
    { teacherId: teachers[1].id, studentId: students[4].id,  courseId: courses[0].id },  // Qari → Abdullah → Nazra
    { teacherId: teachers[1].id, studentId: students[10].id, courseId: courses[1].id },  // Qari → Hamza → Tajweed
    { teacherId: teachers[2].id, studentId: students[2].id,  courseId: courses[3].id },  // Fatima → Ibrahim → Islamic
    { teacherId: teachers[2].id, studentId: students[7].id,  courseId: courses[5].id },  // Fatima → Ruqayyah → Kids
    { teacherId: teachers[2].id, studentId: students[13].id, courseId: courses[3].id },  // Fatima → Amina → Islamic
    { teacherId: teachers[3].id, studentId: students[3].id,  courseId: courses[4].id },  // Omar → Maryam → Arabic
    { teacherId: teachers[3].id, studentId: students[6].id,  courseId: courses[4].id },  // Omar → Yusuf → Arabic
    { teacherId: teachers[3].id, studentId: students[11].id, courseId: courses[4].id },  // Omar → Khadija → Arabic
    { teacherId: teachers[4].id, studentId: students[9].id,  courseId: courses[2].id },  // Aisha → Safiya → Hifz
    { teacherId: teachers[4].id, studentId: students[12].id, courseId: courses[0].id },  // Aisha → Usman → Nazra
    { teacherId: teachers[4].id, studentId: students[14].id, courseId: courses[2].id },  // Aisha → Tariq → Hifz
  ];
  for (const a of assignments) {
    await CourseDetails.findOrCreate({ where: { teacherId: a.teacherId, studentId: a.studentId, courseId: a.courseId }, defaults: a });
    await EnrolledStudents.findOrCreate({ where: { studentId: a.studentId, courseId: a.courseId }, defaults: { studentId: a.studentId, courseId: a.courseId } });
  }
  console.log('✔ CourseDetails & Enrollments');

  console.log('\n✅  Production seed complete.\n');
  process.exit(0);
}

seed().catch(e => { console.error('\n❌ Seed failed:', e.message); process.exit(1); });
