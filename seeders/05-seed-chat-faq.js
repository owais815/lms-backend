// Run order: 5th — seeds chat groups, group members, messages (group + private) and FAQs
// Usage: node seeders/05-seed-chat-faq.js  (from /var/www/lms-backend)
// Assumes admins, teachers and students are already seeded (scripts 01-03)

require('./models/association');
const sequelize      = require('./utils/database');
const ChatGroup      = require('./models/ChatGroup');
const ChatGroupMember= require('./models/ChatGroupMember');
const ChatMessage    = require('./models/ChatMessage');
const FAQ            = require('./models/FAQ');
const CourseDetails  = require('./models/CourseDetails');

const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
const ago   = (days, hrs=0, mins=0) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hrs);
  d.setMinutes(d.getMinutes() - mins);
  return d;
};

async function seed() {
  await sequelize.authenticate();

  // ── Chat Groups ────────────────────────────────────────────────────────────
  const groupDefs = [
    { name: 'General Announcements',      createdBy: 1, createdByType: 'admin' },
    { name: 'Quran Recitation – Nazra',   createdBy: 2, createdByType: 'teacher' },
    { name: 'Tajweed ul Quran Class',     createdBy: 3, createdByType: 'teacher' },
    { name: 'Hifz Programme Group',       createdBy: 5, createdByType: 'teacher' },
    { name: 'Islamic Studies – Junior',   createdBy: 4, createdByType: 'teacher' },
    { name: 'Arabic Language Learners',   createdBy: 7, createdByType: 'teacher' },
  ];
  const groups = [];
  for (const g of groupDefs) {
    const [grp] = await ChatGroup.findOrCreate({ where: { name: g.name }, defaults: g });
    groups.push(grp);
  }
  console.log('✔ Chat groups:', groups.length);

  // ── Group Members (General: admin + all teachers) ──────────────────────────
  const generalGroup = groups[0];
  for (let tid = 1; tid <= 8; tid++) {
    await ChatGroupMember.findOrCreate({ where: { groupId: generalGroup.id, userId: tid, userType: 'teacher' }, defaults: { groupId: generalGroup.id, userId: tid, userType: 'teacher', canSend: tid >= 2 ? false : true } });
  }
  await ChatGroupMember.findOrCreate({ where: { groupId: generalGroup.id, userId: 1, userType: 'admin' }, defaults: { groupId: generalGroup.id, userId: 1, userType: 'admin', canSend: true } });

  // courseId → groupId
  const courseToGroup = { 1: groups[1].id, 2: groups[2].id, 3: groups[3].id, 4: groups[4].id, 5: groups[5].id };
  const allDetails = await CourseDetails.findAll();
  for (const d of allDetails) {
    const gid = courseToGroup[d.courseId];
    if (!gid) continue;
    await ChatGroupMember.findOrCreate({ where: { groupId: gid, userId: d.studentId, userType: 'student' }, defaults: { groupId: gid, userId: d.studentId, userType: 'student', canSend: true } });
    await ChatGroupMember.findOrCreate({ where: { groupId: gid, userId: d.teacherId, userType: 'teacher' }, defaults: { groupId: gid, userId: d.teacherId, userType: 'teacher', canSend: true } });
  }
  console.log('✔ Group members');

  // ── Group Messages ─────────────────────────────────────────────────────────
  const addMsg = async (m) => {
    const ts = ago(m.d, m.h||0, m.m||0);
    return ChatMessage.create({
      message: m.msg, senderId: m.si, senderType: m.st,
      receiverId: m.ri||null, receiverType: m.rt||null,
      isPrivate: !!m.ri, messageType: 'text',
      isRead: true, groupId: m.gid||null,
      createdAt: ts, updatedAt: ts,
    });
  };

  const messages = [
    // General Announcements
    { si:1, st:'admin',   gid:groups[0].id, d:14, h:2,  msg:"Assalamu Alaikum team! Just a heads-up — we've updated the class session management module. You can now mark sessions as completed directly from the dashboard." },
    { si:2, st:'teacher', gid:groups[0].id, d:14, h:1,  msg:"JazakAllah khair! That's going to save so much time. No more going back through the schedule to update statuses." },
    { si:3, st:'teacher', gid:groups[0].id, d:14, h:0,  msg:"Agreed, really helpful update. Will there be a guide or video tutorial for the new flow?" },
    { si:1, st:'admin',   gid:groups[0].id, d:13, h:9,  msg:"Good point — I'll prepare a short walkthrough and share it here by end of day insha'Allah." },
    { si:4, st:'teacher', gid:groups[0].id, d:13, h:8,  msg:"Looking forward to it! Also, is there an update on the parent notification feature that was mentioned last month?" },
    { si:1, st:'admin',   gid:groups[0].id, d:13, h:7,  msg:"Yes, parent notifications are in the next release — expected in about 2 weeks. Parents will get email + portal notifications after each session." },
    { si:5, st:'teacher', gid:groups[0].id, d:12, h:5,  msg:"That's great news! Parents have been asking about progress updates. This will really help with communication." },
    { si:1, st:'admin',   gid:groups[0].id, d:10, h:3,  msg:"Important reminder: please log all completed sessions before the end of this week. Finance relies on these records for the monthly salary calculation." },
    { si:6, st:'teacher', gid:groups[0].id, d:10, h:2,  msg:"Noted! I've just updated all my sessions for this month. Everything is logged." },
    { si:7, st:'teacher', gid:groups[0].id, d:10, h:1,  msg:"Same here — all done. Is there a deadline time on Friday?" },
    { si:1, st:'admin',   gid:groups[0].id, d:10, h:0,  msg:"5 PM UK time on Friday. Thank you both for being prompt as always!" },
    { si:1, st:'admin',   gid:groups[0].id, d:7,  h:4,  msg:"We've just crossed 25 active students — Alhamdulillah! This is a great milestone for the institute. Thank you all for your dedication and hard work." },
    { si:2, st:'teacher', gid:groups[0].id, d:7,  h:3,  msg:"MashaAllah! May Allah bless our students and continue to grow this institute. Ameen." },
    { si:3, st:'teacher', gid:groups[0].id, d:7,  h:2,  msg:"Ameen! It's a blessing to be part of this journey. Looking forward to seeing many more students benefit insha'Allah." },
    { si:4, st:'teacher', gid:groups[0].id, d:7,  h:1,  msg:"Alhamdulillah. The community trust in us means everything. We must continue delivering quality education." },
    { si:1, st:'admin',   gid:groups[0].id, d:4,  h:3,  msg:"Heads up — there will be a staff check-in call this Sunday at 6 PM UK time. Please confirm your availability in this group." },
    { si:2, st:'teacher', gid:groups[0].id, d:4,  h:2,  msg:"Confirmed, I'll be there insha'Allah." },
    { si:3, st:'teacher', gid:groups[0].id, d:4,  h:1,  msg:"Insha'Allah, I'll join. Should we prepare anything?" },
    { si:1, st:'admin',   gid:groups[0].id, d:4,  h:0,  msg:"Just review your current student list and note any concerns. Agenda will be shared Saturday morning." },
    { si:5, st:'teacher', gid:groups[0].id, d:3,  h:5,  msg:"Confirmed from my side too. Insha'Allah see everyone Sunday." },
    { si:6, st:'teacher', gid:groups[0].id, d:3,  h:4,  msg:"I'll be there insha'Allah. Always beneficial to sync as a team." },
    { si:7, st:'teacher', gid:groups[0].id, d:3,  h:3,  msg:"Confirmed. Insha'Allah see you all then." },
    { si:1, st:'admin',   gid:groups[0].id, d:0,  h:2,  msg:"JazakAllah khair everyone for a productive week! Remember: student reports for this month are due by the 12th. Have a blessed weekend!" },
    // Quran Recitation – Nazra
    { si:2, st:'teacher', gid:groups[1].id, d:12, h:3,  msg:"Assalamu Alaikum everyone! I hope you've all had a chance to review Juz Amma this week. We'll be doing a group revision session tomorrow — please come prepared." },
    { si:1, st:'student', gid:groups[1].id, d:12, h:2,  msg:"Wa Alaikum Assalam Ustaz! I've been reviewing daily. Should we focus on any specific Surahs for tomorrow?" },
    { si:2, st:'teacher', gid:groups[1].id, d:12, h:1,  msg:"Focus on Surah An-Naba through Surah Al-Mutaffifin. We'll go through them in order during the session." },
    { si:3, st:'student', gid:groups[1].id, d:11, h:5,  msg:"Ustaz, I have a question — when reciting Surah Al-Naba, is the Madd on آيَاتٍ a natural Madd or connected?" },
    { si:2, st:'teacher', gid:groups[1].id, d:11, h:4,  msg:"Excellent question Zainab! That is a Natural Madd (Madd Tabi'i) — 2 counts. The connected Madd only applies when a Hamza immediately follows the Madd letter." },
    { si:4, st:'student', gid:groups[1].id, d:11, h:2,  msg:"I had the same question actually! Good to know." },
    { si:2, st:'teacher', gid:groups[1].id, d:10, h:3,  msg:"MashaAllah, today's session was very productive! Ibrahim and Adam, your Makharij has improved significantly. Keep it up!" },
    { si:2, st:'teacher', gid:groups[1].id, d:8,  h:4,  msg:"This week's homework: memorise Surah Al-Ghashiyah and be ready to recite it in class on Friday. Ayahs 1-10 at minimum." },
    { si:3, st:'student', gid:groups[1].id, d:8,  h:2,  msg:"Can we record ourselves practising to catch our own mistakes?" },
    { si:2, st:'teacher', gid:groups[1].id, d:8,  h:1,  msg:"That's a fantastic habit Zainab — yes, recording yourself is one of the best ways to identify errors. I strongly encourage it." },
    { si:2, st:'teacher', gid:groups[1].id, d:5,  h:2,  msg:"Reminder: class tomorrow is moved 30 minutes earlier — 8:00 AM instead of 8:30 AM. Please make a note!" },
    { si:2, st:'teacher', gid:groups[1].id, d:2,  h:3,  msg:"Alhamdulillah, everyone recited beautifully today! I'm very proud of this group's progress." },
    { si:1, st:'student', gid:groups[1].id, d:2,  h:2,  msg:"JazakAllah khair Ustaz for your patience and guidance. We wouldn't be here without you." },
    { si:2, st:'teacher', gid:groups[1].id, d:0,  h:1,  msg:"Next class is Monday insha'Allah. Please revise pages 4-6 of Al-Baqarah over the weekend. Come ready with your questions!" },
    // Tajweed ul Quran
    { si:3, st:'teacher', gid:groups[2].id, d:13, h:5,  msg:"Assalamu Alaikum class! Today we covered Ghunna rules. As promised, I'll be uploading the Tajweed rules chart to the resources section." },
    { si:5, st:'student', gid:groups[2].id, d:13, h:4,  msg:"JazakAllah Ustadha! Will it cover the rules for Lam Shamsiyyah and Lam Qamariyyah as well?" },
    { si:3, st:'teacher', gid:groups[2].id, d:13, h:3,  msg:"Yes, those are included along with all the Idgham categories. Very comprehensive, insha'Allah." },
    { si:3, st:'teacher', gid:groups[2].id, d:11, h:4,  msg:"Today we covered Qalqalah. Remember — the five letters: ق ط ب ج د. Mnemonic: 'QaTaBaJaDa'. Practice them with Sukoon at the end of words." },
    { si:5, st:'student', gid:groups[2].id, d:11, h:3,  msg:"QaTaBaJaDa — that's genius! Never going to forget that now." },
    { si:6, st:'student', gid:groups[2].id, d:11, h:2,  msg:"Ustadha, does Qalqalah apply mid-word as well or only at the end?" },
    { si:3, st:'teacher', gid:groups[2].id, d:11, h:1,  msg:"Excellent question! Qalqalah occurs when one of the five letters has a Sukoon — whether mid-word or at end (pause). The echo is stronger at end of verse." },
    { si:3, st:'teacher', gid:groups[2].id, d:9,  h:3,  msg:"Class cancelled tomorrow due to a family emergency. Sorry for the short notice. Make-up session this Sunday at the same time." },
    { si:5, st:'student', gid:groups[2].id, d:9,  h:2,  msg:"No worries at all Ustadha, hope everything is okay. See you Sunday insha'Allah." },
    { si:3, st:'teacher', gid:groups[2].id, d:6,  h:4,  msg:"Alhamdulillah — today we finished all four types of Madd. This is a big chapter done — well done everyone!" },
    { si:3, st:'teacher', gid:groups[2].id, d:1,  h:2,  msg:"Reminder for tomorrow: please bring your Quran — we will be practising live recitation with Tajweed markings. See you at 9 AM insha'Allah!" },
    // Hifz Programme
    { si:5, st:'teacher', gid:groups[3].id, d:14, h:6,  msg:"Bismillah Ar-Rahman Ar-Raheem. Welcome to a new week students! Remember: Hifz is a journey of the heart. Keep your intentions pure." },
    { si:8, st:'student', gid:groups[3].id, d:14, h:5,  msg:"Ameen Ustaz. I read a hadith about the honour of the Hafiz's parents on the Day of Judgment — it gave me so much motivation to continue." },
    { si:9, st:'student', gid:groups[3].id, d:14, h:4,  msg:"MashaAllah. May Allah make us all worthy of that honour. Ameen." },
    { si:10,st:'student', gid:groups[3].id, d:13, h:4,  msg:"Ustaz, I completed my full Manzil this morning before Fajr! It took 45 minutes — is that a good pace?" },
    { si:5, st:'teacher', gid:groups[3].id, d:13, h:3,  msg:"MashaAllah Bilal! Reciting a full Manzil in 45 minutes with correct Tajweed is excellent. Speed comes naturally — focus on quality and consistency first." },
    { si:5, st:'teacher', gid:groups[3].id, d:9,  h:3,  msg:"Today's Sabaq: Surah Al-Kahf Ayahs 45-60. Connect emotionally with the meaning as you memorise — it makes it stick better." },
    { si:5, st:'teacher', gid:groups[3].id, d:5,  h:4,  msg:"Group Manzil check next Saturday at 10 AM. Each student will recite their full Manzil. No stress, insha'Allah!" },
    { si:8, st:'student', gid:groups[3].id, d:5,  h:1,  msg:"May Allah give us all success in this. Ameen. Insha'Allah I'll be there!" },
    { si:5, st:'teacher', gid:groups[3].id, d:2,  h:3,  msg:"MashaAllah team — all three of you recited your Manzil flawlessly today! May Allah keep the Quran in your hearts. Ameen!" },
    { si:5, st:'teacher', gid:groups[3].id, d:0,  h:1,  msg:"New week, new blessings. Monday's Sabaq: Surah Al-Kahf Ayahs 61-75. Begin with Bismillah. You've got this!" },
    // Islamic Studies
    { si:4, st:'teacher', gid:groups[4].id, d:12, h:5,  msg:"Assalamu Alaikum class! Today we discussed the Five Pillars of Islam. Homework: write a short paragraph on each pillar and why it matters to you personally." },
    { si:2, st:'student', gid:groups[4].id, d:12, h:4,  msg:"Wa Alaikum Assalam Ustadha! Should it be a full page per pillar or bullet points?" },
    { si:4, st:'teacher', gid:groups[4].id, d:12, h:3,  msg:"3-5 sentences per pillar is perfect. Focus on your own reflection — there's no wrong answer as long as it comes from the heart." },
    { si:4, st:'teacher', gid:groups[4].id, d:8,  h:4,  msg:"This week we cover the Seerah — specifically the Hijra from Makkah to Madinah. Please read pages 45-52 in your textbook before class." },
    { si:4, st:'student', gid:groups[4].id, d:10, h:1,  msg:"I never thought about the Qibla as a unity symbol before. That's really profound!" },
    { si:4, st:'teacher', gid:groups[4].id, d:5,  h:3,  msg:"Pop quiz results: MashaAllah excellent scores across the board! You should all be very proud." },
    { si:4, st:'teacher', gid:groups[4].id, d:2,  h:2,  msg:"Next class we start Fiqh of Salah — covering the conditions, pillars, and obligations. Please come with a notebook." },
    { si:4, st:'teacher', gid:groups[4].id, d:0,  h:2,  msg:"Assalamu Alaikum all! Class starts in 30 minutes. Today: Fiqh of Salah, Chapter 1 — Taharah. The foundation of Salah is cleanliness. See you soon insha'Allah!" },
    // Arabic Language Learners
    { si:7, st:'teacher', gid:groups[5].id, d:13, h:5,  msg:"Assalamu Alaikum class! Arabic is the language of the Quran, and every word you learn brings you closer to understanding Allah's words directly." },
    { si:3, st:'student', gid:groups[5].id, d:13, h:4,  msg:"Wa Alaikum Assalam! That's such a beautiful way to frame it. It makes every vocabulary word feel meaningful." },
    { si:9, st:'student', gid:groups[5].id, d:12, h:4,  msg:"Ustaz, if the root is ك ت ب (to write), how do I say 'he wrote' vs 'she wrote'?" },
    { si:7, st:'teacher', gid:groups[5].id, d:12, h:3,  msg:"'He wrote' = كَتَبَ (kataba). 'She wrote' = كَتَبَتْ (katabat) — you add a ت at the end for feminine. This applies to all past tense verbs." },
    { si:3, st:'student', gid:groups[5].id, d:12, h:2,  msg:"So ذَهَبَ (dhahaba) means 'he went' and ذَهَبَتْ (dhahabat) means 'she went'?" },
    { si:7, st:'teacher', gid:groups[5].id, d:12, h:1,  msg:"Exactly right Zainab! You've already grasped the pattern. This is excellent progress." },
    { si:7, st:'teacher', gid:groups[5].id, d:10, h:4,  msg:"Today's vocab list — 10 words from the Quran. Memorise them, find the Ayah they appear in, then translate that Ayah. This connects grammar with Quran beautifully." },
    { si:5, st:'student', gid:groups[5].id, d:9,  h:3,  msg:"Found رَحْمَة (mercy) in Surah Al-Fatiha — الرَّحْمَٰنِ الرَّحِيمِ. The Most Merciful, the Especially Merciful. SubhanAllah." },
    { si:7, st:'teacher', gid:groups[5].id, d:9,  h:1,  msg:"MashaAllah! This is exactly what I hoped for. You're not just learning language — you're connecting with the Quran directly." },
    { si:7, st:'teacher', gid:groups[5].id, d:7,  h:3,  msg:"Quiz on Saturday — 20 Quranic vocabulary words from the past 3 weeks. Review your notes and take your time." },
    { si:7, st:'teacher', gid:groups[5].id, d:4,  h:4,  msg:"Quiz results: MashaAllah team! Impressive scores across the board! The hard work is clearly paying off." },
    { si:7, st:'teacher', gid:groups[5].id, d:0,  h:0,  msg:"See you all at 6 PM insha'Allah! Prepare by reviewing your verb forms — we'll need them for sentence building today." },
    // Private messages
    { si:2, st:'teacher', ri:1,  rt:'student', d:4,  h:4, msg:"Assalamu Alaikum Adam, I noticed you were struggling with Surah Al-Imran during class today. Would you like to schedule an extra revision session this week?" },
    { si:1, st:'student', ri:2,  rt:'teacher', d:4,  h:3, msg:"Wa Alaikum Assalam Ustaz. Yes please! Is Thursday afternoon available?" },
    { si:2, st:'teacher', ri:1,  rt:'student', d:4,  h:2, msg:"Thursday at 4 PM works perfectly. I'll create the session in the system. See you then insha'Allah." },
    { si:4, st:'teacher', ri:5,  rt:'student', d:6,  h:4, msg:"Assalamu Alaikum Maryam! Your recitation of Ghunna letters today was excellent, MashaAllah. Keep up this momentum!" },
    { si:5, st:'student', ri:4,  rt:'teacher', d:6,  h:3, msg:"Wa Alaikum Assalam Ustadha, JazakAllah! I practiced every day this week following your advice." },
    { si:1, st:'admin',   ri:2,  rt:'teacher', d:3,  h:3, msg:"Assalamu Alaikum Hafiz Rahman. Your student progress reports have been received — very detailed and helpful for the parents. JazakAllah khair." },
    { si:2, st:'teacher', ri:1,  rt:'admin',   d:3,  h:2, msg:"Wa Alaikum Assalam. Alhamdulillah, I try my best to keep parents informed. Happy to discuss any feedback." },
    { si:1, st:'admin',   ri:3,  rt:'teacher', d:5,  h:5, msg:"Assalamu Alaikum Qari Yusuf! We have a new student who would like to join Tajweed classes. Would you be able to take them on?" },
    { si:3, st:'teacher', ri:1,  rt:'admin',   d:5,  h:4, msg:"Wa Alaikum Assalam! Alhamdulillah, yes I can accommodate. I have a morning slot available on Monday and Wednesday." },
    { si:5, st:'teacher', ri:9,  rt:'student', d:8,  h:5, msg:"Assalamu Alaikum Ruqayyah! I noticed you seemed a little distracted today. Is everything okay?" },
    { si:9, st:'student', ri:5,  rt:'teacher', d:8,  h:4, msg:"Wa Alaikum Assalam Ustaz. I have some school exams this week. I apologise." },
    { si:5, st:'teacher', ri:9,  rt:'student', d:8,  h:3, msg:"No need to apologise at all! Let's just do Manzil revision this week — no pressure for new Sabaq. Good luck with your exams, Ameen!" },
    { si:4, st:'teacher', ri:1,  rt:'admin',   d:6,  h:3, msg:"Assalamu Alaikum! I wanted to check — I noticed my salary for last month hasn't been marked as paid yet. Could you look into it please?" },
    { si:1, st:'admin',   ri:4,  rt:'teacher', d:6,  h:2, msg:"Wa Alaikum Assalam Ustadha Fatima! I'm sorry for the delay. The bank transfer was initiated on Friday and should reflect within 1-2 business days." },
    { si:1, st:'admin',   ri:4,  rt:'teacher', d:5,  h:4, msg:"Alhamdulillah, it's cleared now — I've updated the records. Thank you for your patience and continued dedication Ustadha!" },
  ];

  let msgCount = 0;
  for (const m of messages) { await addMsg(m); msgCount++; }
  console.log('✔ Chat messages:', msgCount);

  // ── FAQs ───────────────────────────────────────────────────────────────────
  const faqs = [
    { category: 'Getting Started', question: 'How do I enrol my child in a course?', answer: 'To enrol your child, log in to your parent account and navigate to the Courses section. Select the course you wish to enrol in, choose a suitable time slot, and click "Enrol Now". Our admin team will confirm the enrolment within 24 hours and you will receive a confirmation email.' },
    { category: 'Getting Started', question: 'What courses does Mualim ul Quran offer?', answer: 'We offer: Quran Recitation (Nazra), Tajweed ul Quran, Hifz ul Quran, Islamic Studies, Arabic Language, and Duas & Surahs for Kids. Each course is taught by qualified and experienced teachers.' },
    { category: 'Getting Started', question: 'How do I access my classes online?', answer: 'Once enrolled, log in to your student portal and click "Join Class" at your scheduled class time. We recommend joining 2-3 minutes early to test your audio and video connection.' },
    { category: 'Getting Started', question: 'Is there a trial class available before I commit?', answer: 'Yes! We offer a free trial class for all new students. Contact our admin team to book. The trial lets you experience our teaching method and meet your potential teacher before committing.' },
    { category: 'Fees & Payments', question: 'What are the monthly fee rates?', answer: 'Basic Plan – £15/month (1 class/week), Standard Plan – £25/month (2 classes/week), Premium Plan – £40/month (unlimited classes). All plans include access to learning resources and progress tracking. Fees are due on the 1st of each month.' },
    { category: 'Fees & Payments', question: 'How can I pay my monthly fees?', answer: 'We accept bank transfer, credit/debit card, and PayPal. Payment details are provided after enrolment. You can also set up a standing order for automatic monthly payments.' },
    { category: 'Fees & Payments', question: 'What happens if I miss a payment?', answer: 'If a payment is missed, you will receive an email reminder on the 5th and 10th of the month. Classes continue during this period. If payment is not received by the 15th, we will be in touch to discuss your situation.' },
    { category: 'Fees & Payments', question: 'Are there any discounts for siblings?', answer: 'Yes! We offer a 10% sibling discount for families with two or more children enrolled simultaneously. The discount is applied automatically when you enrol a second child.' },
    { category: 'Classes & Schedule', question: 'How long is each class?', answer: 'Each class session is 45 minutes long. This duration is optimal for effective learning while maintaining concentration, especially for younger students.' },
    { category: 'Classes & Schedule', question: 'What happens if I need to reschedule a class?', answer: 'Please notify your teacher or admin team at least 2 hours before the class. We will do our best to accommodate a make-up session, subject to teacher availability.' },
    { category: 'Classes & Schedule', question: 'How many students are in each class?', answer: 'We offer one-to-one (individual) and small group classes. Group classes typically have 3-5 students of similar level. You can choose your preference during enrolment.' },
    { category: 'Classes & Schedule', question: 'Do classes take place during school holidays?', answer: 'Our regular class schedule follows the standard academic calendar. During UK school holidays, we typically continue classes unless a student requests time off. Special Ramadan and Eid schedules are announced in advance.' },
    { category: 'Teachers', question: 'Are your teachers qualified?', answer: 'All our teachers hold formal qualifications in Quranic studies and Islamic education. Many have an Ijazah (authorised chain of transmission) in Quran recitation. Teachers undergo a thorough vetting process including background checks.' },
    { category: 'Teachers', question: 'Can I request a specific teacher?', answer: 'Yes, if you have a preferred teacher you can make a request during enrolment or by contacting our admin team. We will try to accommodate your preference, subject to the teacher\'s availability.' },
    { category: 'Teachers', question: 'What happens if my teacher is unavailable?', answer: 'In cases where your teacher is unable to take a class, we will notify you as early as possible and arrange a cover teacher or a make-up session.' },
    { category: 'Technical', question: 'What devices can I use for online classes?', answer: 'Our platform works on any device with a modern web browser — laptop, desktop, tablet, or smartphone. For the best experience, use a laptop or tablet with a stable internet connection and a headset with a microphone.' },
    { category: 'Technical', question: 'The video call is not working. What should I do?', answer: 'Check your internet connection and ensure your browser has permission to access camera and microphone. Try refreshing or clearing browser cache. Chrome or Firefox work best. Contact our support via the chat feature if the issue persists.' },
    { category: 'Technical', question: 'How do I reset my password?', answer: 'Go to the login page and click "Forgot Password". Enter your registered email address and you will receive a reset link within a few minutes. If you do not receive it, check your spam folder.' },
    { category: 'Progress & Reports', question: 'How is my child\'s progress tracked?', answer: 'Teachers provide regular progress updates after each class, visible in your parent/student portal. Monthly written reports cover recitation quality, Tajweed accuracy, memorisation progress, and overall engagement.' },
    { category: 'Progress & Reports', question: 'How do I know if my child is ready to move to the next level?', answer: 'Level progression is assessed by the teacher based on consistent performance over multiple sessions. When ready, the teacher will recommend progression and discuss it with the parent.' },
  ];

  let faqCount = 0;
  for (const f of faqs) {
    await FAQ.findOrCreate({ where: { question: f.question }, defaults: { ...f, isPublished: true } });
    faqCount++;
  }
  console.log('✔ FAQs:', faqCount);

  console.log('\n✅  Chat & FAQ seed complete.\n');
  process.exit(0);
}

seed().catch(e => { console.error('\n❌ Failed:', e.message, '\n', e.stack); process.exit(1); });
