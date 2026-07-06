// Run order: 7th — seeds certificates, support requests, question bank, quizzes+attempts, assignments+submissions
// Usage: node seeders/07-seed-extras.js  (from /var/www/lms-backend)

require('./models/association');
const sequelize           = require('./utils/database');
const CourseDetails       = require('./models/CourseDetails');
const Student             = require('./models/Student');
const Certificate         = require('./models/Certificate');
const SupportRequest      = require('./models/SupportRequest');
const Assignment          = require('./models/Assignment/Assignment');
const SubmittedAssignment = require('./models/Assignment/SubmittedAssignment');
const QuestionBank        = require('./models/QuestionBank');
const Quiz                = require('./models/Quiz/Quiz');
const Question            = require('./models/Quiz/Question');
const QuizAttempt         = require('./models/Quiz/QuizAttempt');

const rnd     = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const dateStr = (daysAgo) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0, 10); };
const dateObj = (daysAgo, hrs = 10) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hrs, 0, 0, 0); return d; };

async function seed() {
  await sequelize.authenticate();

  const students = await Student.findAll({ limit: 26 });
  const cdList   = await CourseDetails.findAll();

  // ── 1. CERTIFICATES ──────────────────────────────────────────────────────────
  const certData = [
    { studentId: 3,  courseId: 1, daysAgo: 45, notes: 'Completed Quran Recitation (Nazra) with distinction. Excellent Makharij and fluency.' },
    { studentId: 6,  courseId: 1, daysAgo: 30, notes: 'Completed Quran Recitation (Nazra). Very consistent and dedicated student.' },
    { studentId: 14, courseId: 1, daysAgo: 20, notes: 'Completed Quran Recitation (Nazra). Great improvement throughout the course.' },
    { studentId: 2,  courseId: 2, daysAgo: 60, notes: 'Completed Tajweed ul Quran with excellent grasp of Madd and Ghunna rules.' },
    { studentId: 10, courseId: 2, daysAgo: 40, notes: 'Completed Tajweed ul Quran. Consistent effort and strong revision habits.' },
    { studentId: 20, courseId: 2, daysAgo: 15, notes: 'Completed Tajweed ul Quran. Impressive progress from beginner to advanced in 4 months.' },
    { studentId: 4,  courseId: 4, daysAgo: 50, notes: 'Completed Islamic Studies Term 1. Outstanding knowledge of Fiqh and Seerah.' },
    { studentId: 18, courseId: 4, daysAgo: 25, notes: 'Completed Islamic Studies Term 1. Thoughtful participation and excellent written work.' },
    { studentId: 5,  courseId: 5, daysAgo: 35, notes: 'Completed Arabic Language Level 1. Strong vocabulary and sentence construction skills.' },
    { studentId: 9,  courseId: 6, daysAgo: 55, notes: 'Completed Duas & Surahs for Kids. All essential duas and Surahs memorised perfectly.' },
    { studentId: 21, courseId: 6, daysAgo: 28, notes: 'Completed Duas & Surahs for Kids. Enthusiastic and bright student, MashaAllah.' },
  ];
  let certCount = 0;
  for (const c of certData) {
    await Certificate.findOrCreate({
      where: { studentId: c.studentId, courseId: c.courseId },
      defaults: { studentId: c.studentId, courseId: c.courseId, issuedAt: dateStr(c.daysAgo), status: 'issued', notes: c.notes }
    });
    certCount++;
  }
  console.log('✔ Certificates:', certCount);

  // ── 2. SUPPORT REQUESTS ──────────────────────────────────────────────────────
  const supportData = [
    { userId: 2,  userType: 'student', priority: 'high',   title: 'Unable to join class — video not loading',       problem: "I've been trying to join my Tajweed class for the past 20 minutes but the video screen stays black. I've tried Chrome and Firefox. My camera and microphone are allowed. Please help as I don't want to miss class.", status: 'resolved', response: 'Thank you for reporting this. We identified a temporary issue with our calling server. It has been resolved. Please try now and let us know if the issue persists. A make-up session has been arranged for you.' },
    { userId: 4,  userType: 'student', priority: 'medium', title: 'Request to change class time slot',              problem: "My school schedule has changed and I'm no longer available at my current class time (9 AM). Could I be moved to the 6 PM or 7 PM evening slot? My teacher is Ustadha Fatima.", status: 'resolved', response: 'Your class has been moved to 6:30 PM UK time starting next Monday. Your teacher has been informed. Please confirm this works for you.' },
    { userId: 7,  userType: 'student', priority: 'normal', title: 'Progress report not showing in portal',          problem: "I completed my Hifz session last Tuesday but I can't see the progress update in my portal. It shows last update as 2 weeks ago. Is this a delay or has it not been submitted?", status: 'resolved', response: "We've checked with your teacher and the progress report was submitted. There was a brief display delay — it should now show correctly. Thank you for flagging this." },
    { userId: 10, userType: 'student', priority: 'high',   title: 'Microphone not working during class',            problem: "During today's session my teacher could not hear me at all. I can hear them fine but my microphone doesn't seem to be transmitting. I tested it outside the app and it works.", status: 'resolved', response: 'This is a known browser permission issue. Please go to browser Settings → Privacy & Security → Microphone and ensure our site is allowed. Clear cache and rejoin. If it continues, try a different browser.' },
    { userId: 12, userType: 'student', priority: 'normal', title: 'Certificate not received after course completion', problem: "I was told my Tajweed certificate would be issued within a week of completion. It has been 10 days and I haven't received it. Could you please check?", status: 'pending', response: null },
    { userId: 15, userType: 'student', priority: 'medium', title: 'Incorrect fee amount charged',                   problem: "My invoice for this month shows £40 (Premium plan) but I'm on the Standard plan at £25/month. There seems to be an error in the billing. Please review and correct.", status: 'resolved', response: "We apologise for this billing error. We've identified the issue and corrected it. You will be refunded the £15 difference. Thank you for bringing this to our attention." },
    { userId: 17, userType: 'student', priority: 'normal', title: 'Request for additional learning resources',      problem: "I'm enrolled in Quran Recitation but I'd love some additional PDF resources for Makharij. Are there any materials I can download between sessions?", status: 'resolved', response: "We've added a set of Makharij practice sheets and a Tajweed basics PDF to your resources section. Go to Student Portal → Resources to access them." },
    { userId: 22, userType: 'student', priority: 'high',   title: 'Teacher cancelled class without notice',         problem: "My class was scheduled for today at 4 PM but I waited for 20 minutes and no one joined. I received no notification. This is the second time this has happened.", status: 'resolved', response: "We sincerely apologise. Your teacher had an unexpected emergency. We have spoken with them and reminded them of our notification policy. A free make-up class has been scheduled." },
    { userId: 2,  userType: 'teacher', priority: 'medium', title: 'Request to update class capacity',               problem: "I currently have 3 students in my Tajweed group class and I'd like to accept one more. Can my group capacity be increased from 3 to 4?", status: 'resolved', response: 'Class capacity updated to 4 students. You can now accept one additional enrolment through the system.' },
    { userId: 4,  userType: 'teacher', priority: 'normal', title: 'Incorrect salary amount for last month',         problem: "My salary for last month is showing as £50 but my agreed rate is £55 per month. This has happened twice now.", status: 'resolved', response: "We apologise for the discrepancy. The shortfall of £5 has been included in this month's payment. We've updated your salary record to ensure this doesn't recur." },
    { userId: 3,  userType: 'teacher', priority: 'high',   title: 'Student being disrespectful in class',           problem: "One of my students has been consistently rude — talking over me, dismissing corrections, and arriving 15+ minutes late without notice. I've addressed it directly but the behaviour continues.", status: 'resolved', response: "Thank you for bringing this to us. We have spoken with the student and their parent. A formal warning has been issued and they have acknowledged the expected standards of conduct." },
    { userId: 6,  userType: 'teacher', priority: 'normal', title: 'Cannot upload resource file',                    problem: "I'm trying to upload a PDF Tajweed chart for my students (2.3MB) but the upload keeps failing with an error message.", status: 'resolved', response: "The issue was a temporary upload server error which has been resolved. Please try uploading again. If it persists, contact support with a screenshot of the error." },
    { userId: 7,  userType: 'teacher', priority: 'medium', title: 'Request for Arabic keyboard on portal',          problem: "When I write Arabic text in the notes or feedback sections, I have to copy-paste from another application. Could we add an Arabic keyboard toggle or ensure proper RTL text display?", status: 'pending', response: null },
  ];
  for (const s of supportData) {
    await SupportRequest.create({ title: s.title, problem: s.problem, userId: s.userId, userType: s.userType, priority: s.priority, status: s.status, responseFromAdmin: s.response || null });
  }
  console.log('✔ Support requests:', supportData.length);

  // ── 3. QUESTION BANK ──────────────────────────────────────────────────────────
  const qbData = [
    { type: 'multiple_choice', subject: 'Tajweed',         question: 'Which of the following is NOT one of the five Qalqalah letters?',    options: ['ق','ط','س','ب'],                          correctAnswer: 'س',        createdBy: 1 },
    { type: 'multiple_choice', subject: 'Tajweed',         question: "How many counts is a Natural Madd (Madd Tabi'i)?",                   options: ['1 count','2 counts','4 counts','6 counts'],correctAnswer: '2 counts', createdBy: 1 },
    { type: 'true_false',      subject: 'Tajweed',         question: 'Idgham means to completely merge the Noon Saakin into the following letter.', options: ['True','False'],                correctAnswer: 'True',     createdBy: 1 },
    { type: 'multiple_choice', subject: 'Tajweed',         question: 'Which rule applies when a Noon Saakin is followed by a ب?',         options: ['Idgham','Ikhfa','Iqlab','Izhar'],          correctAnswer: 'Iqlab',    createdBy: 1 },
    { type: 'true_false',      subject: 'Tajweed',         question: 'Waqf Lazim means it is permissible to stop at that point.',          options: ['True','False'],                           correctAnswer: 'False',    createdBy: 1 },
    { type: 'multiple_choice', subject: 'Tajweed',         question: 'How many letters trigger Ikhfa?',                                   options: ['5','10','15','20'],                        correctAnswer: '15',       createdBy: 1 },
    { type: 'short_answer',    subject: 'Tajweed',         question: 'Define Makharij al-Huruf and explain why it is important in Quran recitation.', options: null,                          correctAnswer: 'Makharij al-Huruf refers to the points of articulation for Arabic letters. It ensures each letter is pronounced from its correct point, which preserves meaning and fulfils Tajweed requirements.', createdBy: 1 },
    { type: 'multiple_choice', subject: 'Islamic Studies', question: 'Which pillar of Islam comes after the declaration of faith (Shahada)?', options: ['Salah','Zakat','Sawm','Hajj'],        correctAnswer: 'Salah',    createdBy: 1 },
    { type: 'multiple_choice', subject: 'Islamic Studies', question: 'In which year (CE) did the Hijra from Makkah to Madinah take place?',  options: ['610 CE','615 CE','622 CE','632 CE'],    correctAnswer: '622 CE',   createdBy: 1 },
    { type: 'true_false',      subject: 'Islamic Studies', question: 'Zakat is obligatory on every Muslim, regardless of wealth.',          options: ['True','False'],                          correctAnswer: 'False',    createdBy: 1 },
    { type: 'multiple_choice', subject: 'Islamic Studies', question: 'The Quran was revealed over approximately how many years?',            options: ['10 years','15 years','20 years','23 years'], correctAnswer: '23 years', createdBy: 1 },
    { type: 'true_false',      subject: 'Islamic Studies', question: 'The Prophet Muhammad ﷺ was born in the city of Madinah.',            options: ['True','False'],                          correctAnswer: 'False',    createdBy: 1 },
    { type: 'multiple_choice', subject: 'Islamic Studies', question: "How many Rak'ahs does the Fajr prayer have?",                        options: ['2','3','4','5'],                          correctAnswer: '2',        createdBy: 1 },
    { type: 'short_answer',    subject: 'Islamic Studies', question: 'What are the five pillars of Islam? List them in order.',             options: null,                                       correctAnswer: '1. Shahada, 2. Salah, 3. Zakat, 4. Sawm, 5. Hajj.',  createdBy: 1 },
    { type: 'multiple_choice', subject: 'Arabic Language', question: 'What is the Arabic word for "book"?',                                options: ['كِتَاب','قَلَم','بَيت','مَاء'],           correctAnswer: 'كِتَاب',   createdBy: 1 },
    { type: 'multiple_choice', subject: 'Arabic Language', question: 'How do you say "he wrote" in Arabic (past tense)?',                  options: ['يَكتُب','كَتَبَ','كِتَاب','كَاتِب'],      correctAnswer: 'كَتَبَ',   createdBy: 1 },
    { type: 'true_false',      subject: 'Arabic Language', question: 'Arabic is written from right to left.',                              options: ['True','False'],                           correctAnswer: 'True',     createdBy: 1 },
    { type: 'multiple_choice', subject: 'Arabic Language', question: 'What does the word "رَحمَة" mean in English?',                       options: ['Knowledge','Mercy','Peace','Guidance'],   correctAnswer: 'Mercy',    createdBy: 1 },
    { type: 'short_answer',    subject: 'Arabic Language', question: 'Conjugate the verb "ذَهَبَ" for: he, she, you (male), and I.',       options: null,                                       correctAnswer: 'He: ذَهَبَ | She: ذَهَبَتْ | You (male): ذَهَبتَ | I: ذَهَبتُ', createdBy: 1 },
    { type: 'multiple_choice', subject: 'Quran',           question: 'How many Surahs are there in the Holy Quran?',                       options: ['100','110','114','120'],                  correctAnswer: '114',      createdBy: 1 },
    { type: 'multiple_choice', subject: 'Quran',           question: 'Which is the longest Surah in the Quran?',                           options: ['Al-Imran','Al-Baqarah','An-Nisa','Al-Maidah'], correctAnswer: 'Al-Baqarah', createdBy: 1 },
    { type: 'true_false',      subject: 'Quran',           question: 'Surah Al-Fatiha has 7 verses (Ayahs).',                              options: ['True','False'],                           correctAnswer: 'True',     createdBy: 1 },
    { type: 'multiple_choice', subject: 'Quran',           question: 'Which Juz does Surah Al-Kahf begin in?',                             options: ['Juz 14','Juz 15','Juz 16','Juz 17'],     correctAnswer: 'Juz 15',   createdBy: 1 },
    { type: 'short_answer',    subject: 'Quran',           question: 'What is the meaning of "Juz Amma" and which Surah does it begin with?', options: null,                                  correctAnswer: 'Juz Amma is the 30th Juz of the Quran, named after its first word "Amma". It begins with Surah An-Naba (Chapter 78).', createdBy: 1 },
  ];
  for (const q of qbData) {
    await QuestionBank.create({ ...q, options: q.options ? JSON.stringify(q.options) : null });
  }
  console.log('✔ Question bank:', qbData.length, 'entries');

  // ── 4. QUIZZES + QUESTIONS + ATTEMPTS ─────────────────────────────────────────
  const quizDefs = [
    {
      title: "Tajweed Basics – Madd & Qalqalah", instructions: 'Answer all questions. You have 20 minutes. Each question carries equal marks.', duration: 20, passingScore: 60, status: 'active',
      teacherId: 3, courseId: 2,
      questions: [
        { type: 'multiple_choice', question: "How many counts is a Natural Madd (Madd Tabi'i)?", options: ['1','2','4','6'], correctAnswer: '2' },
        { type: 'multiple_choice', question: 'Which of the following is a Qalqalah letter?',    options: ['أ','س','ب','ن'],  correctAnswer: 'ب' },
        { type: 'true_false',      question: 'Idgham means to completely merge the Noon Saakin into the following letter.', options: ['True','False'], correctAnswer: 'True' },
        { type: 'multiple_choice', question: 'Which rule applies when Noon Saakin is followed by ب?', options: ['Idgham','Ikhfa','Iqlab','Izhar'], correctAnswer: 'Iqlab' },
        { type: 'true_false',      question: 'There are 5 Qalqalah letters.',                   options: ['True','False'],   correctAnswer: 'True' },
      ],
      attemptStudentIds: [2, 10, 12]
    },
    {
      title: 'Islamic Studies – Pillars & Seerah', instructions: 'Read each question carefully. 25 minutes allowed. Pass mark is 65%.', duration: 25, passingScore: 65, status: 'active',
      teacherId: 4, courseId: 4,
      questions: [
        { type: 'multiple_choice', question: 'Which pillar of Islam comes immediately after Shahada?', options: ['Zakat','Salah','Sawm','Hajj'], correctAnswer: 'Salah' },
        { type: 'multiple_choice', question: 'In which year CE did the Hijra occur?',                  options: ['610','615','622','632'],       correctAnswer: '622'  },
        { type: 'true_false',      question: 'Zakat is obligatory on every Muslim regardless of wealth.', options: ['True','False'],            correctAnswer: 'False' },
        { type: 'multiple_choice', question: "How many Rak'ahs are in the Fajr prayer?",               options: ['2','3','4','5'],              correctAnswer: '2'    },
        { type: 'true_false',      question: 'The Prophet ﷺ was born in Madinah.',                     options: ['True','False'],              correctAnswer: 'False' },
      ],
      attemptStudentIds: [4, 15, 18]
    },
    {
      title: 'Arabic Language – Vocabulary & Verbs', instructions: 'Test on vocabulary and verb conjugations covered in Weeks 1-4. 15 minutes.', duration: 15, passingScore: 70, status: 'active',
      teacherId: 7, courseId: 5,
      questions: [
        { type: 'multiple_choice', question: 'What does "كِتَاب" mean?',              options: ['Pen','Book','House','Water'],    correctAnswer: 'Book'      },
        { type: 'multiple_choice', question: 'How do you say "she wrote" in Arabic?', options: ['كَتَبَ','كَتَبَتْ','يَكتُب','تَكتُب'], correctAnswer: 'كَتَبَتْ' },
        { type: 'true_false',      question: 'Arabic is written from right to left.', options: ['True','False'],                  correctAnswer: 'True'      },
        { type: 'multiple_choice', question: 'What does "رَحمَة" mean?',               options: ['Knowledge','Mercy','Peace','Guidance'], correctAnswer: 'Mercy' },
        { type: 'multiple_choice', question: 'The root of "كِتَاب" comes from which three letters?', options: ['ك ر م','ك ت ب','ع ل م','ذ ه ب'], correctAnswer: 'ك ت ب' },
      ],
      attemptStudentIds: [5, 8, 13]
    },
  ];

  let quizCount = 0, attemptCount = 0;
  for (const qd of quizDefs) {
    const cd = cdList.find(c => c.courseId === qd.courseId);
    if (!cd) continue;
    const quiz = await Quiz.create({ title: qd.title, instructions: qd.instructions, duration: qd.duration, passingScore: qd.passingScore, status: qd.status, teacherId: qd.teacherId, courseDetailsId: cd.id, studentId: cd.studentId });
    quizCount++;
    for (const q of qd.questions) {
      await Question.create({ quizId: quiz.id, type: q.type, question: q.question, options: q.options ? JSON.stringify(q.options) : null, correctAnswer: q.correctAnswer });
    }
    for (const sid of qd.attemptStudentIds) {
      await QuizAttempt.create({ quizId: quiz.id, studentId: sid, startTime: dateObj(rnd(5, 20), rnd(9, 19)), endTime: dateObj(rnd(1, 4), rnd(9, 19)), score: rnd(55, 100) });
      attemptCount++;
    }
  }
  console.log('✔ Quizzes:', quizCount, '| Attempts:', attemptCount);

  // ── 5. ASSIGNMENTS + SUBMISSIONS ─────────────────────────────────────────────
  const assignDefs = [
    {
      title: 'Tajweed Rules Reflection – Madd & Ghunna',
      description: 'Write a 1-page reflection (300-400 words) on the Madd and Ghunna rules. Include: (1) definition of each rule, (2) three Quran examples for each, (3) one challenge you faced and how you overcame it.',
      daysUntilDue: -7, maxScore: 100, teacherId: 3, courseId: 2,
      submissions: [
        { studentId: 2,  score: 88, feedback: "Excellent reflection! Your Quran examples are accurate and your personal reflection shows real depth. Very well written." },
        { studentId: 10, score: 75, feedback: "Good effort! The Madd section is strong. The Ghunna examples could be more varied — try to include examples from different Surahs." },
        { studentId: 20, score: 92, feedback: "Outstanding work! One of the best reflections I've read. Your analysis of the challenge section was particularly insightful." },
      ]
    },
    {
      title: 'Islamic Studies – Pillars of Islam Essay',
      description: 'Write a short essay (400-500 words) explaining the Five Pillars of Islam. For each pillar: (1) explain its meaning, (2) describe how it benefits individual and society, (3) include at least one relevant hadith or Quranic verse.',
      daysUntilDue: -5, maxScore: 100, teacherId: 4, courseId: 4,
      submissions: [
        { studentId: 4,  score: 95, feedback: "Exceptional essay! Every pillar is covered with depth and the hadith references are appropriate and well-explained." },
        { studentId: 18, score: 80, feedback: "Strong work. Your essay on Salah and Zakat is excellent. The Hajj section could be expanded — it felt a little brief." },
        { studentId: 24, score: 70, feedback: "Good start! For the next assignment, focus on incorporating more Quranic evidence to strengthen your points." },
      ]
    },
    {
      title: 'Arabic Vocabulary – 20 Quranic Words',
      description: 'For each of the 20 vocabulary words provided in class: (1) write the Arabic word, (2) its English meaning, (3) the Ayah in which it appears, (4) your own sentence using the word in Arabic.',
      daysUntilDue: -3, maxScore: 80, teacherId: 7, courseId: 5,
      submissions: [
        { studentId: 5,  score: 76, feedback: "MashaAllah — very thorough! All 20 words completed with correct Ayah references. Your own sentences show you're applying the vocabulary actively." },
        { studentId: 19, score: 65, feedback: "Good effort. 17 out of 20 words completed. The missing three are highlighted — please complete and resubmit by Friday." },
        { studentId: 25, score: 72, feedback: "Solid work! Your Quranic references are all correct. Some personal sentences need grammar correction — we'll review in the next class." },
      ]
    },
    {
      title: 'Hifz Progress Journal – Weekly Entry',
      description: 'Maintain a 4-week Hifz journal. Each week: (1) new Sabaq memorised (Surah + Ayah numbers), (2) Sabqi revision completed, (3) Manzil review duration, (4) one reflection on your experience.',
      daysUntilDue: -10, maxScore: 60, teacherId: 5, courseId: 3,
      submissions: [
        { studentId: 9,  score: 58, feedback: "Outstanding journal! Your consistency in revision is evident. The reflections are heartfelt and show a true love for the Quran. JazakAllah khair." },
        { studentId: 11, score: 50, feedback: "Very good effort. Weeks 3 and 4 are detailed and excellent. Weeks 1-2 could have more detail on your Sabqi revision schedule." },
      ]
    },
  ];

  let assignCount = 0, subCount = 0;
  for (const ad of assignDefs) {
    const cd = cdList.find(c => c.courseId === ad.courseId);
    if (!cd) continue;
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + ad.daysUntilDue);
    const assignment = await Assignment.create({ title: ad.title, description: ad.description, dueDate, maxScore: ad.maxScore, status: 'active', teacherId: ad.teacherId, courseDetailsId: cd.id });
    assignCount++;
    for (const sub of ad.submissions) {
      await SubmittedAssignment.create({ assignmentId: assignment.id, studentId: sub.studentId, teacherId: ad.teacherId, score: sub.score, feedback: sub.feedback, submissionDate: dateObj(rnd(2, 8), rnd(10, 20)), status: 'Graded' });
      subCount++;
    }
  }
  console.log('✔ Assignments:', assignCount, '| Submissions:', subCount);

  console.log('\n✅  Extras seed complete.\n');
  process.exit(0);
}

seed().catch(e => { console.error('\n❌', e.message, '\n', e.stack); process.exit(1); });
