// Run order: 3rd — creates parents for all students, links them, assigns profile images
// Also populates TeacherStudent table from CourseDetails (run after 01 + 02)
// Usage: node seeders/03-seed-parents.js  (from /var/www/lms-backend)
// Note: profile images (parent-m-60..81.jpg, parent-f-60..62.jpg) must be in resources/profiles/

const bcrypt = require('bcryptjs');
require('./models/association');
const sequelize       = require('./utils/database');
const Student         = require('./models/Student');
const Parent          = require('./models/Parent');
const CourseDetails   = require('./models/CourseDetails');
const TeacherStudent  = require('./models/TeacherStudent');

const h = (p) => bcrypt.hashSync(p, 12);

async function seed() {
  await sequelize.authenticate();

  // ── 1. Create parents & link to students ──────────────────────────────────
  const parentDefs = [
    // Existing parents (students 1-6) — created in 01-seed-prod but parentId not always set
    { username: 'parent.demo',    firstName: 'Demo',        lastName: 'Parent',   email: 'parent.demo@gmail.com',       contact: '+447000000001', timeZone: 'Europe/London',      profileImg: 'resources/profiles/parent-m-60.jpg', studentIds: [1]  },
    { username: 'khalid.ali',     firstName: 'Khalid',      lastName: 'Ali',      email: 'khalidali@gmail.com',         contact: '+923331112601', timeZone: 'Asia/Karachi',       profileImg: 'resources/profiles/parent-m-61.jpg', studentIds: [2]  },
    { username: 'nusrat.khan',    firstName: 'Nusrat',      lastName: 'Khan',     email: 'nusratkhan@gmail.com',        contact: '+447911123602', timeZone: 'Europe/London',      profileImg: 'resources/profiles/parent-f-60.jpg', studentIds: [3]  },
    { username: 'yusra.hassan',   firstName: 'Yusra',       lastName: 'Hassan',   email: 'yusrahassan@gmail.com',       contact: '+12025551603',  timeZone: 'America/New_York',   profileImg: 'resources/profiles/parent-f-61.jpg', studentIds: [4]  },
    { username: 'salma.siddiqui', firstName: 'Salma',       lastName: 'Siddiqui', email: 'salmasiddiqui@gmail.com',     contact: '+16135551604',  timeZone: 'America/Toronto',    profileImg: 'resources/profiles/parent-f-62.jpg', studentIds: [5]  },
    { username: 'rashid.ahmed',   firstName: 'Rashid',      lastName: 'Ahmed',    email: 'rashidahmed@gmail.com',       contact: '+61412345605',  timeZone: 'Australia/Sydney',   profileImg: 'resources/profiles/parent-m-62.jpg', studentIds: [6]  },
    // New parents for students 7-26
    { username: 'abid.rahman',    firstName: 'Abid',        lastName: 'Rahman',   email: 'abid.rahman@gmail.com',       contact: '+447911201001', timeZone: 'Europe/London',      profileImg: 'resources/profiles/parent-m-63.jpg', studentIds: [7]  },
    { username: 'tariq.malik',    firstName: 'Tariq',       lastName: 'Malik',    email: 'tariq.malik@gmail.com',       contact: '+923001001002', timeZone: 'Asia/Karachi',       profileImg: 'resources/profiles/parent-m-64.jpg', studentIds: [8]  },
    { username: 'farhan.omar',    firstName: 'Farhan',      lastName: 'Omar',     email: 'farhan.omar@gmail.com',       contact: '+14165550903',  timeZone: 'America/Toronto',    profileImg: 'resources/profiles/parent-m-65.jpg', studentIds: [9]  },
    { username: 'imran.hussain',  firstName: 'Imran',       lastName: 'Hussain',  email: 'imran.hussain@gmail.com',     contact: '+447911201004', timeZone: 'Europe/London',      profileImg: 'resources/profiles/parent-m-66.jpg', studentIds: [10] },
    { username: 'asif.iqbal',     firstName: 'Asif',        lastName: 'Iqbal',    email: 'asif.iqbal@gmail.com',        contact: '+923211001005', timeZone: 'Asia/Karachi',       profileImg: 'resources/profiles/parent-m-67.jpg', studentIds: [11] },
    { username: 'ahmad.farooq',   firstName: 'Ahmad',       lastName: 'Farooq',   email: 'ahmad.farooq@gmail.com',      contact: '+447911201006', timeZone: 'Europe/London',      profileImg: 'resources/profiles/parent-m-68.jpg', studentIds: [12] },
    { username: 'mustafa.tariq',  firstName: 'Mustafa',     lastName: 'Tariq',    email: 'mustafa.tariq@gmail.com',     contact: '+61412201007',  timeZone: 'Australia/Sydney',   profileImg: 'resources/profiles/parent-m-69.jpg', studentIds: [13] },
    { username: 'zahid.sheikh',   firstName: 'Zahid',       lastName: 'Sheikh',   email: 'zahid.sheikh@gmail.com',      contact: '+447911201008', timeZone: 'Europe/London',      profileImg: 'resources/profiles/parent-m-70.jpg', studentIds: [14] },
    { username: 'shahid.baig',    firstName: 'Shahid',      lastName: 'Baig',     email: 'shahid.baig@gmail.com',       contact: '+447911201009', timeZone: 'Europe/London',      profileImg: 'resources/profiles/parent-m-71.jpg', studentIds: [15] },
    { username: 'kamal.aziz',     firstName: 'Kamal',       lastName: 'Aziz',     email: 'kamal.aziz@gmail.com',        contact: '+447911201010', timeZone: 'Europe/London',      profileImg: 'resources/profiles/parent-m-72.jpg', studentIds: [16] },
    { username: 'john.smith',     firstName: 'John',        lastName: 'Smith',    email: 'john.smith@gmail.com',        contact: '+447911201011', timeZone: 'Europe/London',      profileImg: 'resources/profiles/parent-m-73.jpg', studentIds: [17] },
    { username: 'michael.johnson',firstName: 'Michael',     lastName: 'Johnson',  email: 'michael.johnson@gmail.com',   contact: '+12025551012',  timeZone: 'America/New_York',   profileImg: 'resources/profiles/parent-m-74.jpg', studentIds: [18] },
    { username: 'david.brown',    firstName: 'David',       lastName: 'Brown',    email: 'david.brown@gmail.com',       contact: '+61412201013',  timeZone: 'Australia/Brisbane', profileImg: 'resources/profiles/parent-m-75.jpg', studentIds: [19] },
    { username: 'robert.williams',firstName: 'Robert',      lastName: 'Williams', email: 'robert.williams@gmail.com',   contact: '+447911201014', timeZone: 'Europe/London',      profileImg: 'resources/profiles/parent-m-76.jpg', studentIds: [20] },
    { username: 'mark.davis',     firstName: 'Mark',        lastName: 'Davis',    email: 'mark.davis@gmail.com',        contact: '+16135551015',  timeZone: 'America/Montreal',   profileImg: 'resources/profiles/parent-m-77.jpg', studentIds: [21] },
    { username: 'andrew.wilson',  firstName: 'Andrew',      lastName: 'Wilson',   email: 'andrew.wilson@gmail.com',     contact: '+12135551016',  timeZone: 'America/Chicago',    profileImg: 'resources/profiles/parent-m-78.jpg', studentIds: [22] },
    { username: 'daniel.taylor',  firstName: 'Daniel',      lastName: 'Taylor',   email: 'daniel.taylor@gmail.com',     contact: '+971501231017', timeZone: 'Asia/Dubai',         profileImg: 'resources/profiles/parent-m-79.jpg', studentIds: [23] },
    { username: 'peter.anderson', firstName: 'Peter',       lastName: 'Anderson', email: 'peter.anderson@gmail.com',    contact: '+447911201018', timeZone: 'Europe/London',      profileImg: 'resources/profiles/parent-m-80.jpg', studentIds: [24] },
    { username: 'chris.martin',   firstName: 'Christopher', lastName: 'Martin',   email: 'chris.martin@gmail.com',      contact: '+61412201019',  timeZone: 'Australia/Perth',    profileImg: 'resources/profiles/parent-m-81.jpg', studentIds: [25] },
    { username: 'thomas.clark',   firstName: 'Thomas',      lastName: 'Clark',    email: 'thomas.clark@gmail.com',      contact: '+16045551020',  timeZone: 'America/Edmonton',   profileImg: 'resources/profiles/parent-m-60.jpg', studentIds: [26] },
  ];

  for (const p of parentDefs) {
    const { studentIds, ...fields } = p;
    const [parent] = await Parent.findOrCreate({
      where: { username: fields.username },
      defaults: { ...fields, password: h('Parent@1234'), isActive: true }
    });
    await Parent.update({ profileImg: fields.profileImg }, { where: { id: parent.id } });
    for (const sid of studentIds) {
      await Student.update({ parentId: parent.id }, { where: { id: sid } });
    }
  }
  console.log('✔ 26 parents created/linked with profile images');

  // ── 2. Populate TeacherStudent from CourseDetails ──────────────────────────
  const details = await CourseDetails.findAll();
  let tsAdded = 0;
  for (const d of details) {
    if (!d.teacherId) continue;
    const [, isNew] = await TeacherStudent.findOrCreate({
      where: { TeacherId: d.teacherId, StudentId: d.studentId },
      defaults: { TeacherId: d.teacherId, StudentId: d.studentId }
    });
    if (isNew) tsAdded++;
  }
  console.log('✔ TeacherStudent entries created:', tsAdded);

  console.log('\n✅  All done.\n');
  process.exit(0);
}
seed().catch(e => { console.error('\n❌', e.message, '\n', e.stack); process.exit(1); });
