require('dotenv').config();
const express = require("express");
const https = require("https");
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
const parentRoutes = require("./routes/parent");
const planRoutes = require("./routes/plan");
const planChangeRoutes = require("./routes/planchangereq");
const paymentRoutes = require("./routes/payment");
const questionBankRoutes = require("./routes/questionBank");
const classScheduleRoutes = require("./routes/classSchedule");
const coursePDFRoutes = require("./routes/coursePDF");





const cleanupAnnouncements = require('./Schedular/Cleanupannouncements');
const { startMessageCleanup } = require('./Schedular/cleanupMessages');
const isAuth = require('./middleware/is-auth');
const io =  require('./socket').getIO();

// Choose the environment
const env = process.env.NODE_ENV || "development";
const serverConfig = require(`./config/${env}`);
// require('./Schedular/scheduledTasks');
const bodyParser = require("body-parser");
const sequelize = require("./utils/database");
const multer = require("multer");
const cors = require("cors");
const app = express();

// Ensure upload directory exists
const resourcesDir = path.join(__dirname, "resources");
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
}
const {
  Teacher,
  Student,
  TeacherStudent,
  StudentFeedback,
  UpcomingClass,
  Quiz,
  QuizAttempt,
  Assignment,
  SubmittedAssignment,
  Attendance,
  MyBookmark,
  Resource,
  AdminFeedback,
  MakeUpClass,
  Courses,
  UpcomingCourses,
  ClassSchedule,
  ClassSession,
} = require("./models/association");

const allowedOrigins = [
  process.env.CORS_ORIGIN_DEV,
  process.env.CORS_ORIGIN_PROD,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));

app.use(bodyParser.json());

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "resources");
  },
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    cb(null, `${timestamp}-${file.originalname}`);
  },
});
const http = require('http').createServer(app);
const fileFilter = (req, file, cb) => {

  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg" ||
    file.mimetype === "application/pdf" ||
    file.mimetype === "application/vnd.ms-powerpoint" ||
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    file.mimetype === "application/msword" ||
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: images (PNG/JPG), PDF, Word, PowerPoint'), false);
  }
};
// PDF upload route uses its own multer (array, pdf-only) — must be mounted
// BEFORE the global single-file multer so the request body isn't consumed first.
app.use("/api/course-pdfs", coursePDFRoutes);

// Voice message upload — must be mounted BEFORE global multer to prevent
// the global middleware from consuming/discarding the 'voice' file field.
const voiceFileFilter = (req, file, cb) => cb(null, file.mimetype.startsWith('audio/'));
const voiceUpload = multer({ storage: fileStorage, fileFilter: voiceFileFilter }).single('voice');
app.post('/api/chat/upload-voice', isAuth, voiceUpload, (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No audio file received' });
  res.json({ mediaUrl: `resources/${req.file.filename}` });
});

app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single("file")
);

// // Resource upload configuration (new)
// const resourceStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'resources');
//   },
//   filename: (req, file, cb) => {
//     cb(null, `${Date.now()}-${file.originalname}`);
//   },
// });
// app.use(
//   multer({ storage: resourceStorage, fileFilter: fileFilter }).single('file')
// );


// app.use("/images", express.static(path.join(__dirname, "resources")));
// app.use('/resources', express.static(path.join(__dirname, "resources")))
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
app.use("/api/parent", parentRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/planchange", planChangeRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/questionBank", questionBankRoutes);
app.use("/api/class-schedule", classScheduleRoutes);







app.use((error, req, res, next) => {
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});




cleanupAnnouncements();
startMessageCleanup(io);
const port = serverConfig.port || process.env.PORT || 8080;
const host = serverConfig.host || process.env.HOST || 'localhost';
// Sequelize alter:true silently drops ENUM columns on MySQL — patch them back after sync
async function patchEnumColumns() {
  const patches = [
    // Students
    `ALTER TABLE Students ADD COLUMN status ENUM('active','inactive') DEFAULT 'active'`,
    // Quizzes
    `ALTER TABLE Quizzes ADD COLUMN status ENUM('pending','active','rejected') DEFAULT 'active'`,
    // Questions
    `ALTER TABLE Questions ADD COLUMN type ENUM('multiple_choice','true_false','short_answer') NOT NULL DEFAULT 'multiple_choice'`,
    // Assignments
    `ALTER TABLE Assignments ADD COLUMN status ENUM('pending','active','rejected') DEFAULT 'active'`,
    // SubmittedAssignments
    `ALTER TABLE SubmittedAssignments ADD COLUMN status ENUM('Not Started','In Progress','Submitted','Graded') NOT NULL DEFAULT 'Not Started'`,
    // Attendances
    `ALTER TABLE Attendances ADD COLUMN status ENUM('Present','Absent') NOT NULL DEFAULT 'Present'`,
    // ClassSchedules
    `ALTER TABLE ClassSchedules ADD COLUMN recurrenceType ENUM('one-time','weekly','biweekly') NOT NULL DEFAULT 'one-time'`,
    `ALTER TABLE ClassSchedules ADD COLUMN status ENUM('pending','active','cancelled') NOT NULL DEFAULT 'active'`,
    `ALTER TABLE ClassSchedules ADD COLUMN createdBy ENUM('admin','teacher') NOT NULL DEFAULT 'admin'`,
    // ClassSessions
    `ALTER TABLE ClassSessions ADD COLUMN status ENUM('scheduled','completed','cancelled','makeup') NOT NULL DEFAULT 'scheduled'`,
    // MakeUpClass
    `ALTER TABLE MakeUpClass ADD COLUMN status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending'`,
    // AdminFeedback
    `ALTER TABLE AdminFeedback ADD COLUMN areasToImprove ENUM('Reading','Writing','Speaking','Listening') DEFAULT NULL`,
    `ALTER TABLE AdminFeedback ADD COLUMN progressInGrades ENUM('A','B','C','D','F') NOT NULL DEFAULT 'A'`,
    // SupportRequests
    `ALTER TABLE SupportRequests ADD COLUMN userType ENUM('student','teacher') NOT NULL DEFAULT 'student'`,
    `ALTER TABLE SupportRequests ADD COLUMN priority ENUM('high','medium','normal') DEFAULT 'normal'`,
    `ALTER TABLE SupportRequests ADD COLUMN status ENUM('pending','resolved','rejected') DEFAULT 'pending'`,
    // Announcements
    `ALTER TABLE Announcements ADD COLUMN type ENUM('payment','class','general','assessment') NOT NULL DEFAULT 'general'`,
    // QuestionBanks
    `ALTER TABLE QuestionBanks ADD COLUMN type ENUM('multiple_choice','true_false','short_answer') NOT NULL DEFAULT 'multiple_choice'`,
    // PlanChangeRequests
    `ALTER TABLE PlanChangeRequests ADD COLUMN status ENUM('pending','approved','rejected') DEFAULT 'pending'`,
    `ALTER TABLE PlanChangeRequests ADD COLUMN paymentStatus ENUM('pending','paid') DEFAULT 'pending'`,
    // ChatMessages
    `ALTER TABLE ChatMessages ADD COLUMN messageType ENUM('text','voice') NOT NULL DEFAULT 'text'`,
  ];
  for (const sql of patches) {
    try {
      await sequelize.query(sql);
    } catch (_) {
      // column already exists — ignore
    }
  }
}

sequelize
  .sync({ alter: true })
  .then(async () => {
    await patchEnumColumns();
    if (env === "production") {
      serverConfig.startServer(app);
      (async () => {
        const io = await require('./socket').getIO();
        io.on('connection', (socket) => {
          console.log("connection established...!!!");
          handleConnection(socket,io);
        });
    })();
    } else {
      // http.listen(port, () => {
      //   console.log(`Server is running on http://${host}:${port}`);
      //   console.log("Socket.IO is ready for connections");
      // });
      serverConfig.startServer(app);
     
      (async () => {
        const io = await require('./socket').getIO();
        io.on('connection', (socket) => {
          console.log("connection established...!!!");
          handleConnection(socket,io);
        });
    })();

    }
  })
  .catch((err) => {
    console.error('DB sync failed — server will not start:', err);
    process.exit(1);
  });
