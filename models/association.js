const Teacher = require("./Teacher");
const Student = require("./Student");
const TeacherStudent = require("./TeacherStudent");
const CourseDetails = require("./CourseDetails");
const StudentFeedback = require("./StudentFeedback");
const UpcomingClass = require("./UpcomingClasses");
const Quiz = require("./Quiz/Quiz");
const QuizAttempt = require("./Quiz/QuizAttempt");
const Question = require("./Quiz/Question");
const Assignment = require("./Assignment/Assignment");
const SubmittedAssignment = require("./Assignment/SubmittedAssignment");
const Attendance = require("./Attendance");
const MyBookmark = require("./Bookmarks/MyBookmark");
const Resource = require("./Resource");
const AdminFeedback = require("./AdminFeedback/AdminFeedback");
const MakeUpClass = require("./MakeupClasses/MakeUpClass");
const Courses = require("./Course");
const UpcomingCourses = require("./UpcomingCourse");
const EnrolledStudents = require("./EnrolledStudents");
const Blog = require("./Blog");
const Survey = require("./Survey");
const WeeklyResource = require("./WeeklyResources");
const WeeklyContent = require("./WeeklyContent");
const Plan = require("./Plan");
const PlanChangeRequest = require("./PlanChangeRequest");
const Payment = require("./Payment");
const QuestionBank = require("./QuestionBank");
const ClassSchedule = require("./ClassSchedule");
const ClassSession = require("./ClassSession");
const CoursePDF = require("./CoursePDF");
const TeacherAttendance = require("./TeacherAttendance");

// Setup associations
Teacher.belongsToMany(Student, {
  through: TeacherStudent,
  onDelete: "CASCADE",
});
Student.belongsToMany(Teacher, {
  through: TeacherStudent,
  onDelete: "CASCADE",
});

// New Courses associations
Courses.hasMany(CourseDetails, { foreignKey: "courseId" });
CourseDetails.belongsTo(Courses, { foreignKey: "courseId" });

CourseDetails.belongsTo(Teacher, { foreignKey: "teacherId" });
CourseDetails.belongsTo(Student, { foreignKey: "studentId" });

Courses.hasMany(UpcomingCourses, { foreignKey: "courseId" });
UpcomingCourses.belongsTo(Courses, { foreignKey: "courseId" });

UpcomingCourses.belongsTo(Teacher, { foreignKey: "teacherId" });
UpcomingCourses.belongsTo(Student, { foreignKey: "studentId" });

// StudentFeedback associations
StudentFeedback.belongsTo(Teacher, { foreignKey: "teacherId" });
StudentFeedback.belongsTo(Student, { foreignKey: "studentId" });

// UpcomingClass associations
UpcomingClass.belongsTo(Teacher, { foreignKey: "teacherId" });
UpcomingClass.belongsTo(Student, { foreignKey: "studentId" });
UpcomingClass.belongsTo(CourseDetails, { foreignKey: "courseDetailsId" });
CourseDetails.hasMany(UpcomingClass, { foreignKey: "courseDetailsId" });

// Quiz associations
Quiz.belongsTo(Teacher, { foreignKey: 'teacherId' });
Quiz.belongsTo(CourseDetails, { foreignKey: 'courseDetailsId', as: 'CourseDetails' });
Quiz.belongsTo(Student, { foreignKey: 'studentId' });
Quiz.hasMany(Question, { foreignKey: 'quizId' });
QuizAttempt.belongsTo(Student, { foreignKey: 'studentId' });
Quiz.hasMany(QuizAttempt, { foreignKey: 'quizId' });
QuizAttempt.belongsTo(Quiz, { foreignKey: 'quizId' });

// Assignment associations
Assignment.belongsTo(CourseDetails, { foreignKey: 'courseDetailsId', as: 'CourseDetails' });
Assignment.belongsTo(Teacher, { foreignKey: 'teacherId' });

SubmittedAssignment.belongsTo(Assignment, { foreignKey: 'assignmentId' });
SubmittedAssignment.belongsTo(Student, { foreignKey: 'studentId' });
SubmittedAssignment.belongsTo(Teacher, { foreignKey: 'teacherId' });

Assignment.hasMany(SubmittedAssignment, { foreignKey: 'assignmentId' });
Student.hasMany(SubmittedAssignment, { foreignKey: 'studentId' });
Teacher.hasMany(SubmittedAssignment, { foreignKey: 'teacherId' });

// Attendance associations
Attendance.belongsTo(Student, { foreignKey: 'studentId' });
Attendance.belongsTo(CourseDetails, { foreignKey: 'courseDetailsId' });
Attendance.belongsTo(ClassSession, { foreignKey: 'sessionId' });
Student.hasMany(Attendance, { foreignKey: 'studentId' });
CourseDetails.hasMany(Attendance, { foreignKey: 'courseDetailsId' });
ClassSession.hasMany(Attendance, { foreignKey: 'sessionId' });

// TeacherAttendance associations
TeacherAttendance.belongsTo(Teacher, { foreignKey: 'teacherId' });
Teacher.hasMany(TeacherAttendance, { foreignKey: 'teacherId' });

// MyBookmark associations
Student.hasMany(MyBookmark, { foreignKey: 'studentId' });
CourseDetails.hasMany(MyBookmark, { foreignKey: 'courseDetailsId' });
Resource.hasMany(MyBookmark, { foreignKey: 'resourceId' });

// AdminFeedback associations
Student.hasMany(AdminFeedback, { foreignKey: 'studentId' });
CourseDetails.hasMany(AdminFeedback, { foreignKey: 'courseDetailsId' });

// MakeUpClass associations
Student.hasMany(MakeUpClass, { foreignKey: 'studentId' });
CourseDetails.hasMany(MakeUpClass, { foreignKey: 'courseDetailsId' });
Teacher.hasMany(MakeUpClass, { foreignKey: 'teacherId' });

Student.belongsToMany(Courses, {
  through: EnrolledStudents,
  foreignKey: "studentId",
  onDelete: "CASCADE",
});

Courses.belongsToMany(Student, {
  through: EnrolledStudents,
  foreignKey: "courseId",
  onDelete: "CASCADE",
});

EnrolledStudents.belongsTo(Student, { foreignKey: 'studentId' });
EnrolledStudents.belongsTo(Courses, { foreignKey: 'courseId' });

Student.hasMany(UpcomingClass, { foreignKey: 'studentId' });
Teacher.hasMany(UpcomingClass, { foreignKey: 'teacherId' });

WeeklyResource.belongsTo(WeeklyContent, { foreignKey: 'weeklyContentId' });
WeeklyContent.hasMany(WeeklyResource, {
  foreignKey: 'weeklyContentId',
  as: 'resources', 
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

//Plan
Student.belongsTo(Plan, { foreignKey: 'planId', allowNull: false });
Plan.hasMany(Student, { foreignKey: 'planId' });

//Plan change Request
Student.hasMany(PlanChangeRequest, { foreignKey: 'studentId' });
PlanChangeRequest.belongsTo(Student, { foreignKey: 'studentId' });

Plan.hasMany(PlanChangeRequest, { foreignKey: 'currentPlanId', as: 'CurrentPlan' });
PlanChangeRequest.belongsTo(Plan, { foreignKey: 'currentPlanId', as: 'CurrentPlan' });

Plan.hasMany(PlanChangeRequest, { foreignKey: 'requestedPlanId', as: 'RequestedPlan' });
PlanChangeRequest.belongsTo(Plan, { foreignKey: 'requestedPlanId', as: 'RequestedPlan' });


//payment
Student.hasMany(Payment, { foreignKey: 'studentId' });
Payment.belongsTo(Student, { foreignKey: 'studentId' });

// ClassSchedule associations
ClassSchedule.belongsTo(Courses, { foreignKey: 'courseId' });
ClassSchedule.belongsTo(Teacher, { foreignKey: 'teacherId' });
ClassSchedule.belongsTo(Student, { foreignKey: 'studentId' });
ClassSchedule.belongsTo(CourseDetails, { foreignKey: 'courseDetailsId' });
ClassSchedule.hasMany(ClassSession, { foreignKey: 'scheduleId', as: 'sessions', onDelete: 'CASCADE' });

// CoursePDF associations
Courses.hasMany(CoursePDF, { foreignKey: 'courseId', as: 'pdfs', onDelete: 'CASCADE' });
CoursePDF.belongsTo(Courses, { foreignKey: 'courseId' });

// ClassSession associations
ClassSession.belongsTo(ClassSchedule, { foreignKey: 'scheduleId', as: 'schedule' });
ClassSession.belongsTo(Courses, { foreignKey: 'courseId' });
ClassSession.belongsTo(Teacher, { foreignKey: 'teacherId' });
ClassSession.belongsTo(Student, { foreignKey: 'studentId' });
ClassSession.belongsTo(CourseDetails, { foreignKey: 'courseDetailsId' });

module.exports = {
  Teacher,
  Student,
  TeacherStudent,
  StudentFeedback,
  UpcomingClass,
  Quiz,
  QuizAttempt,
  CourseDetails,
  Assignment,
  SubmittedAssignment,
  Attendance,
  MyBookmark,
  Resource,
  AdminFeedback,
  MakeUpClass,
  Courses,
  UpcomingCourses,
  EnrolledStudents,
  Blog,
  WeeklyResource,
  QuestionBank,
  ClassSchedule,
  ClassSession,
  CoursePDF,
  TeacherAttendance,
};