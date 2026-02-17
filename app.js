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





const cleanupAnnouncements = require('./Schedular/Cleanupannouncements');
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
  UpcomingCourses
} = require("./models/association");

app.use(cors());

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
    cb(null, false);
  }
};
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

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

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







app.use((error, req, res, next) => {
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});




cleanupAnnouncements();
const port = serverConfig.port || process.env.PORT || 8080;
const host = serverConfig.host || process.env.HOST || 'localhost';
sequelize
  .sync()
  .then(() => {
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
    console.log(err);
  });
