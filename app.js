require('dotenv').config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const { handleConnection } = require('./SocketMethods/HandleConnection');

const adminRoutes = require("./routes/admin");
const courseRoutes = require("./routes/courseDetails");
const quizRoutes = require("./routes/quiz");
const assignmentRoutes = require("./routes/assignment");
const attendanceRoutes = require("./routes/attendance");
const authRoutes = require("./routes/auth");
const teacherRoutes = require("./routes/teacher");
const studentRoutes = require("./routes/student");
const resourceRoutes = require("./routes/resource");
const bookmarkRoutes = require("./routes/bookmark");
const adminFeedbackRoutes = require("./routes/adminfeedback");
const makeupClassRoutes = require("./routes/makeupclass");
const upcomingCoursesRoutes = require("./routes/upcomingCourse");
const blogRoutes = require("./routes/Blog");
const surveyRoutes = require("./routes/survey");
const weeklyContentRoutes = require("./routes/weeklyContent");
const supportRoutes = require("./routes/supportRequest");
const chatRoutes = require("./routes/messages");
const chatGroupRoutes = require("./routes/chatGroups");
const parentRoutes = require("./routes/parent");
const planRoutes = require("./routes/plan");
const planChangeRoutes = require("./routes/planchangereq");
const paymentRoutes = require("./routes/payment");
const questionBankRoutes = require("./routes/questionBank");
const classScheduleRoutes = require("./routes/classSchedule");
const coursePDFRoutes = require("./routes/coursePDF");
const notificationRoutes = require("./routes/notifications");
const teacherAttendanceRoutes = require("./routes/teacherAttendance");
const sessionFeedbackRoutes = require("./routes/feedback");
const feesRoutes = require("./routes/fees");
const faqRoutes = require("./routes/faq");
const certificateRoutes = require("./routes/certificate");
const salaryRoutes = require("./routes/salary");

const cleanupAnnouncements = require('./Schedular/Cleanupannouncements');
const { startMessageCleanup } = require('./Schedular/cleanupMessages');
const { startOverdueFeesCron } = require('./Schedular/markOverdueFees');
const { startAutoEndSessionsCron } = require('./Schedular/autoEndSessions');
const isAuth = require('./middleware/is-auth');

// Choose the environment
const env = process.env.NODE_ENV || "development";
const serverConfig = require(`./config/${env}`);

const bodyParser = require("body-parser");
const sequelize = require("./utils/database");
const multer = require("multer");
const cors = require("cors");
const app = express();

// ── Startup error safety net ────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  // Exit so the process manager (PM2/systemd) can restart cleanly
  process.exit(1);
});

// Ensure upload directory exists
const resourcesDir = path.join(__dirname, "resources");
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
}

require("./models/association");

const allowedOrigins = [
  process.env.CORS_ORIGIN_DEV,
  process.env.CORS_ORIGIN_PROD,
  process.env.CALLING_APP_URL || 'https://localhost:3010',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
}));

app.use(bodyParser.json());

const fileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, "resources");
  },
  filename: (_req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    cb(null, `${timestamp}-${file.originalname}`);
  },
});

// ── File upload security ────────────────────────────────────────────────────
// Validate by both MIME type AND extension to make spoofing harder.
// (True magic-byte validation requires memoryStorage + the file-type package.)
const ALLOWED_MIMETYPES = new Set([
  "image/png",
  "image/jpg",
  "image/jpeg",
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.ppt', '.pptx', '.doc', '.docx']);

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIMETYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: images (PNG/JPG), PDF, Word, PowerPoint'), false);
  }
};

// ── coursePDF route MUST come before global multer middleware ────────────────
app.use("/api/course-pdfs", coursePDFRoutes);

// ── Voice upload — MUST come before global multer middleware ─────────────────
const voiceFileFilter = (_req, file, cb) => {
  if (file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are accepted for voice messages'), false);
  }
};
const voiceUpload = multer({
  storage: fileStorage,
  fileFilter: voiceFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
}).single('voice');

app.post('/api/chat/upload-voice', isAuth, voiceUpload, (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No audio file received' });
  res.json({ mediaUrl: `resources/${req.file.filename}` });
});

// ── Global single-file multer (images, PDFs, Word, PPT) — 10 MB limit ───────
app.use(
  multer({
    storage: fileStorage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  }).single("file")
);

app.use("/api/resources", express.static(path.join(__dirname, "resources")));
app.use("/api/auth", authRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/course", courseRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/resource", resourceRoutes);
app.use("/api/assignment", assignmentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/bookmark", bookmarkRoutes);
app.use("/api/adminFeedback", adminFeedbackRoutes);
app.use("/api/makeupclass", makeupClassRoutes);
app.use("/api/upcomingCourses", upcomingCoursesRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/survey", surveyRoutes);
app.use("/api/weeklyContent", weeklyContentRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/chat/groups", chatGroupRoutes);
app.use("/api/parent", parentRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/planchange", planChangeRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/questionBank", questionBankRoutes);
app.use("/api/class-schedule", classScheduleRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/teacher-attendance", teacherAttendanceRoutes);
app.use("/api/session-feedback", sessionFeedbackRoutes);
app.use("/api/fees", feesRoutes);
app.use("/api/faq", faqRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/salary", salaryRoutes);

// ── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, _next) => {
  const status = error.statusCode || 500;
  const isProd = env === 'production';
  // In production, hide internal server error details to avoid leaking stack traces
  const message = (status === 500 && isProd)
    ? 'An internal server error occurred.'
    : error.message;
  const body = { message };
  // Only expose validation data (status 422) — never expose 500 data in production
  if (error.data && (status !== 500 || !isProd)) {
    body.data = error.data;
  }
  res.status(status).json(body);
});

// ── Sequelize alter:true silently drops ENUM columns — patch them back ────────
async function patchEnumColumns() {
  const patches = [
    `ALTER TABLE Students ADD COLUMN status ENUM('active','inactive') DEFAULT 'active'`,
    `ALTER TABLE Quizzes ADD COLUMN status ENUM('pending','active','rejected') DEFAULT 'active'`,
    `ALTER TABLE Questions ADD COLUMN type ENUM('multiple_choice','true_false','short_answer') NOT NULL DEFAULT 'multiple_choice'`,
    `ALTER TABLE Assignments ADD COLUMN status ENUM('pending','active','rejected') DEFAULT 'active'`,
    `ALTER TABLE SubmittedAssignments ADD COLUMN status ENUM('Not Started','In Progress','Submitted','Graded') NOT NULL DEFAULT 'Not Started'`,
    `ALTER TABLE Attendances ADD COLUMN status ENUM('Present','Absent') NOT NULL DEFAULT 'Present'`,
    `ALTER TABLE ClassSchedules ADD COLUMN recurrenceType ENUM('one-time','weekly','biweekly') NOT NULL DEFAULT 'one-time'`,
    `ALTER TABLE ClassSchedules ADD COLUMN status ENUM('pending','active','cancelled') NOT NULL DEFAULT 'active'`,
    `ALTER TABLE ClassSchedules ADD COLUMN createdBy ENUM('admin','teacher') NOT NULL DEFAULT 'admin'`,
    `ALTER TABLE ClassSessions ADD COLUMN status ENUM('scheduled','completed','cancelled','makeup') NOT NULL DEFAULT 'scheduled'`,
    `ALTER TABLE MakeUpClass ADD COLUMN status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending'`,
    `ALTER TABLE AdminFeedback ADD COLUMN areasToImprove ENUM('Reading','Writing','Speaking','Listening') DEFAULT NULL`,
    `ALTER TABLE AdminFeedback ADD COLUMN progressInGrades ENUM('A','B','C','D','F') NOT NULL DEFAULT 'A'`,
    `ALTER TABLE SupportRequests ADD COLUMN userType ENUM('student','teacher') NOT NULL DEFAULT 'student'`,
    `ALTER TABLE SupportRequests ADD COLUMN priority ENUM('high','medium','normal') DEFAULT 'normal'`,
    `ALTER TABLE SupportRequests ADD COLUMN status ENUM('pending','resolved','rejected') DEFAULT 'pending'`,
    `ALTER TABLE Announcements ADD COLUMN type ENUM('payment','class','general','assessment') NOT NULL DEFAULT 'general'`,
    `ALTER TABLE QuestionBanks ADD COLUMN type ENUM('multiple_choice','true_false','short_answer') NOT NULL DEFAULT 'multiple_choice'`,
    `ALTER TABLE PlanChangeRequests ADD COLUMN status ENUM('pending','approved','rejected','completed') DEFAULT 'pending'`,
    `ALTER TABLE PlanChangeRequests ADD COLUMN paymentStatus ENUM('pending','paid') DEFAULT 'pending'`,
    `ALTER TABLE ChatMessages ADD COLUMN messageType ENUM('text','voice') NOT NULL DEFAULT 'text'`,
    `ALTER TABLE TeacherAttendances ADD COLUMN status ENUM('Present','Absent') NOT NULL DEFAULT 'Absent'`,
    `ALTER TABLE Fees ADD COLUMN status ENUM('pending','paid','overdue','cancelled') NOT NULL DEFAULT 'pending'`,
    `ALTER TABLE Students ADD COLUMN shift ENUM('Morning','Afternoon','Evening') DEFAULT NULL`,
    `ALTER TABLE Teachers ADD COLUMN shift TEXT DEFAULT NULL`,
    `ALTER TABLE Teachers MODIFY COLUMN shift TEXT DEFAULT NULL`,
    `ALTER TABLE ClassSchedules ADD COLUMN shift ENUM('Morning','Afternoon','Evening') DEFAULT NULL`,
    `ALTER TABLE ClassSessions ADD COLUMN shift ENUM('Morning','Afternoon','Evening') DEFAULT NULL`,
    `ALTER TABLE ClassSessions ADD COLUMN sessionStatus ENUM('idle','live','ended') NOT NULL DEFAULT 'idle'`,
    `ALTER TABLE Certificates ADD COLUMN status ENUM('upcoming','issued','revoked') NOT NULL DEFAULT 'issued'`,
  ];
  for (const sql of patches) {
    try {
      await sequelize.query(sql);
    } catch (_) {
      // Column already exists — ignore duplicate-column errors
    }
  }
}

sequelize
  .sync({ alter: true })
  .then(async () => {
    await patchEnumColumns();

    // Start server (this calls socket.init internally)
    serverConfig.startServer(app);

    // Attach the main Socket.IO connection handler ONCE, after socket.init() runs
    const io = await require('./socket').getIO();
    io.on('connection', (socket) => {
      handleConnection(socket, io);
    });

    // Start background cron jobs now that io is ready
    cleanupAnnouncements();
    startMessageCleanup(io);
    startOverdueFeesCron();
    startAutoEndSessionsCron();

    console.log(`[app] Server started in ${env} mode.`);
  })
  .catch((err) => {
    console.error('[app] DB sync failed — server will not start:', err);
    process.exit(1);
  });
