// Run order: 4th — seeds fees, salaries, payments, expenses, class sessions
// Usage: node seeders/04-seed-finance.js  (from /var/www/lms-backend)

require('./models/association');
const sequelize        = require('./utils/database');
const Admin            = require('./models/Admin');
const Teacher          = require('./models/Teacher');
const Student          = require('./models/Student');
const Course           = require('./models/Course');
const CourseDetails    = require('./models/CourseDetails');
const Fee              = require('./models/Fee');
const Salary           = require('./models/Salary');
const Payment          = require('./models/Payment');
const Expense          = require('./models/Expense');
const ExpenseCategory  = require('./models/ExpenseCategory');
const ClassSession     = require('./models/ClassSession');

// date helpers
const addDays  = (d, n)  => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0,10); };
const monthStart = (offset) => { const d = new Date('2026-07-01'); d.setMonth(d.getMonth() + offset); return d.toISOString().slice(0,10); };
const fmt = (d) => new Date(d).toISOString().slice(0,10);
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function seed() {
  await sequelize.authenticate();
  console.log('Connected.\n');

  const admin    = await Admin.findOne({ where: { username: 'Mualim' } });
  const adminId  = admin?.id || null;
  const teachers = await Teacher.findAll();
  const students = await Student.findAll();
  const courses  = await Course.findAll();
  const details  = await CourseDetails.findAll();

  if (!teachers.length || !students.length) {
    console.error('Run the main seed first!'); process.exit(1);
  }

  // ── Expense Categories ────────────────────────────────────────────────────
  const catNames = ['Software & Tools', 'Marketing', 'Office Supplies', 'Utilities', 'Teacher Training', 'Miscellaneous'];
  const cats = [];
  for (const name of catNames) {
    const [c] = await ExpenseCategory.findOrCreate({ where: { name }, defaults: { name, status: 'Active' } });
    cats.push(c);
  }
  console.log('✔ Expense categories');

  // ── Fees (last 4 months per student) ─────────────────────────────────────
  const planPrices = { 1: 15, 2: 25, 3: 40 };
  const feeStatuses = ['paid','paid','paid','paid','pending','overdue'];
  for (const student of students) {
    const amt = planPrices[student.planId] || 25;
    for (let m = -3; m <= 0; m++) {
      const due  = addDays(monthStart(m), 5);
      const isPast = m < 0;
      const st   = isPast ? pick(['paid','paid','paid','overdue']) : pick(['pending','paid']);
      const paid = st === 'paid' ? addDays(due, rnd(-2, 10)) : null;
      await Fee.create({
        studentId   : student.id,
        planId      : student.planId,
        title       : `Monthly Tuition – ${new Date(due).toLocaleString('en-GB',{month:'long',year:'numeric'})}`,
        amount      : amt,
        status      : st,
        dueDate     : due,
        paidDate    : paid,
        notes       : st === 'overdue' ? 'Payment reminder sent via email.' : null,
        createdById : adminId,
      });
    }
  }
  console.log('✔ Fees');

  // ── Salaries (last 4 months per teacher) ─────────────────────────────────
  const salaryAmounts = { 0: 350, 1: 350, 2: 300, 3: 300, 4: 300, 5: 280, 6: 280 };
  for (let i = 0; i < teachers.length; i++) {
    const teacher = teachers[i];
    const base = salaryAmounts[i] || 300;
    for (let m = -3; m <= 0; m++) {
      const mon  = monthStart(m);
      const due  = addDays(mon, 28);
      const isPast = m < -1;
      const st   = isPast ? 'paid' : (m === -1 ? pick(['paid','unpaid']) : 'unpaid');
      const paid = st === 'paid' ? addDays(due, rnd(0, 5)) : null;
      await Salary.create({
        teacherId   : teacher.id,
        amount      : base,
        month       : mon,
        dueDate     : due,
        status      : st,
        paidDate    : paid,
        notes       : st === 'paid' ? 'Bank transfer completed.' : null,
        createdById : adminId,
      });
    }
  }
  console.log('✔ Salaries');

  // ── Payments ──────────────────────────────────────────────────────────────
  const purposes = ['Plan Purchase', 'Monthly Subscription', 'Plan Renewal', 'Course Enrollment'];
  for (const student of students) {
    const amt = planPrices[student.planId] || 25;
    for (let m = -3; m <= 0; m++) {
      const d = new Date(monthStart(m));
      d.setDate(rnd(1, 20));
      if (m < 0 || rnd(0,1)) {
        await Payment.create({
          studentId  : student.id,
          amount     : amt,
          purpose    : pick(purposes),
          paymentDate: d,
        });
      }
    }
  }
  console.log('✔ Payments');

  // ── Expenses ──────────────────────────────────────────────────────────────
  const expenseTemplates = [
    { title: 'Zoom Pro Annual Subscription',      catIdx: 0, amount: 149.90, method: 'Credit Card' },
    { title: 'Google Workspace Business',          catIdx: 0, amount:  72.00, method: 'Credit Card' },
    { title: 'Facebook Ads – Ramadan Campaign',    catIdx: 1, amount: 250.00, method: 'Bank Transfer' },
    { title: 'Google Ads – May Campaign',          catIdx: 1, amount: 180.00, method: 'Credit Card' },
    { title: 'Printer Cartridges & A4 Paper',      catIdx: 2, amount:  38.50, method: 'Cash' },
    { title: 'Office Stationery Bundle',           catIdx: 2, amount:  22.00, method: 'Cash' },
    { title: 'Electricity Bill',                   catIdx: 3, amount:  95.00, method: 'Bank Transfer' },
    { title: 'Internet & Phone (Monthly)',         catIdx: 3, amount:  55.00, method: 'Bank Transfer' },
    { title: 'Tajweed Workshop for Staff',         catIdx: 4, amount: 120.00, method: 'Bank Transfer' },
    { title: 'Online Teaching Certificate',        catIdx: 4, amount:  85.00, method: 'Credit Card' },
    { title: 'Miscellaneous Office Expenses',      catIdx: 5, amount:  45.00, method: 'Cash' },
    { title: 'Bank Charges',                       catIdx: 5, amount:  12.00, method: 'Other' },
  ];
  for (let m = -5; m <= 0; m++) {
    const base = new Date(monthStart(m));
    const subset = expenseTemplates.filter((_, i) => i % 3 === ((m + 6) % 3) || rnd(0,1));
    for (const e of subset) {
      const d = new Date(base);
      d.setDate(rnd(3, 25));
      await Expense.create({
        title         : e.title,
        categoryId    : cats[e.catIdx]?.id || null,
        amount        : e.amount,
        date          : fmt(d),
        purchasedBy   : pick(['Mualim Admin', 'Office Manager', 'Finance Team']),
        paymentMethod : e.method,
        status        : pick(['Approved','Approved','Approved','Pending']),
        notes         : null,
        createdById   : adminId,
      });
    }
  }
  console.log('✔ Expenses');

  // ── Class Sessions (past 30 days + next 7 days) ───────────────────────────
  const sessionTitles = {
    'Quran Recitation (Nazra)' : ['Surah Al-Baqarah – Revision','Makharij Practice – Letters','Fluency Drill – Juz Amma','Reading Assessment'],
    'Tajweed ul Quran'         : ['Ghunna & Ikhfa Rules','Qalqalah Letters','Madd Rules – Revision','Waqf & Ibtida'],
    'Hifz ul Quran'            : ['Sabaq – Surah Al-Kahf pg 3','Sabqi Revision – Last 10 Surahs','Manzil Review','New Sabaq – Al-Anbiya'],
    'Islamic Studies'          : ['Pillars of Islam','Prophet\'s Seerah – Hijra','Fiqh of Salah','Aqeedah – Tawheed'],
    'Arabic Language'          : ['Verb Conjugation – Past Tense','Sentence Structure Practice','Vocabulary Quiz','Root Words – Quran'],
    'Duas & Surahs for Kids'   : ['Surah Al-Fatiha Memorisation','Dua Before Eating & Sleeping','Surah Al-Ikhlas Practice','Islamic Manners'],
  };
  const times = [
    { start: '08:00:00', end: '08:45:00', shift: 'Morning' },
    { start: '09:00:00', end: '09:45:00', shift: 'Morning' },
    { start: '10:00:00', end: '10:45:00', shift: 'Morning' },
    { start: '14:00:00', end: '14:45:00', shift: 'Afternoon' },
    { start: '15:00:00', end: '15:45:00', shift: 'Afternoon' },
    { start: '18:00:00', end: '18:45:00', shift: 'Evening' },
    { start: '19:00:00', end: '19:45:00', shift: 'Evening' },
  ];

  let sessionCount = 0;
  for (const detail of details) {
    const course  = courses.find(c => c.id === detail.courseId);
    if (!course) continue;
    const titlePool = sessionTitles[course.courseName] || ['Class Session'];
    const slot = pick(times);

    // Past 30 days — completed sessions (every 3–4 days)
    for (let daysAgo = 30; daysAgo >= 1; daysAgo -= rnd(3, 5)) {
      const d = new Date('2026-07-07');
      d.setDate(d.getDate() - daysAgo);
      const dateStr = fmt(d);
      const isLate  = rnd(0, 9) < 1; // 10% cancelled
      await ClassSession.create({
        title            : pick(titlePool),
        date             : dateStr,
        startTime        : slot.start,
        endTime          : slot.end,
        shift            : slot.shift,
        status           : isLate ? 'cancelled' : 'completed',
        sessionStatus    : 'ended',
        courseId         : detail.courseId,
        teacherId        : detail.teacherId,
        studentId        : detail.studentId,
        courseDetailsId  : detail.id,
        roomId           : `lms-${detail.id}-${daysAgo}`,
        notes            : isLate ? 'Student unavailable.' : null,
        lessonTitle      : isLate ? null : pick(titlePool),
        lessonDescription: isLate ? null : 'Covered today\'s topic with exercises and Q&A.',
      });
      sessionCount++;
    }

    // Upcoming 7 days — scheduled
    for (let ahead = 1; ahead <= 7; ahead += rnd(2, 4)) {
      const d = new Date('2026-07-07');
      d.setDate(d.getDate() + ahead);
      await ClassSession.create({
        title           : pick(titlePool),
        date            : fmt(d),
        startTime       : slot.start,
        endTime         : slot.end,
        shift           : slot.shift,
        status          : 'scheduled',
        sessionStatus   : 'idle',
        courseId        : detail.courseId,
        teacherId       : detail.teacherId,
        studentId       : detail.studentId,
        courseDetailsId : detail.id,
        roomId          : `lms-${detail.id}-u${ahead}`,
      });
      sessionCount++;
    }
  }
  console.log(`✔ Class Sessions (${sessionCount} total)`);

  console.log('\n✅  Finance seed complete.\n');
  process.exit(0);
}

seed().catch(e => { console.error('\n❌ Failed:', e.message, '\n', e.stack); process.exit(1); });
