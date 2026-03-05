const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Role = require("../models/Roles");
const Rights = require("../models/Rights");
const AdminRights = require("../models/AdminRights");
const Teacher = require("../models/Teacher");
const { Op, Sequelize } = require("sequelize");
const sequelize = require("../utils/database");
const Student = require("../models/Student");
const CourseDetails = require("../models/CourseDetails");
const {
  QuizAttempt,
  SubmittedAssignment,
  Assignment,
  Quiz,
  Attendance,
  UpcomingClass,
  Courses,
  Fee,
  PlanChangeRequest,
  TeacherStudent,
  EnrolledStudents,
  MyBookmark,
  AdminFeedback,
  MakeUpClass,
  StudentFeedback,
  UpcomingCourses,
  ClassSchedule,
  ClassSession,
  SessionFeedback,
  Resource,
} = require("../models/association");
const Payment = require("../models/Payment");
const Plan = require("../models/Plan");
const Survey = require("../models/Survey");

exports.signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation failed.");
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }

  const {
    username,
    firstName,
    lastName,
    password,
    contact,
    email,
    address,
    planId,
    amount, // Optional custom amount from the frontend
    countryName,
    state,
    city,
    timeZone,
    flexibleHours,
    suitableHours,
    nameForTeacher,
    shift,
  } = req.body;

  const t = await sequelize.transaction();
  try {
    // Step 1: Validate plan before creating anything
    const plan = await Plan.findByPk(planId, { transaction: t });
    if (!plan) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Plan not found." });
    }

    // Step 2: Hash the password
    const hashedPwd = await bcrypt.hash(password, 12);

    // Step 3: Create the student
    const student = await Student.create({
      username,
      firstName,
      lastName,
      contact,
      email,
      password: hashedPwd,
      address,
      planId,
      countryName,
      state,
      city,
      timeZone,
      flexibleHours,
      suitableHours,
      nameForTeacher,
      shift: shift || null,
    }, { transaction: t });

    // Step 4: Record the payment (use custom amount if provided, otherwise plan price)
    const payment = await Payment.create({
      studentId: student.id,
      amount: amount || plan.price,
      purpose: "Plan Purchase",
    }, { transaction: t });

    await t.commit();

    res.status(201).json({
      success: true,
      message: "Student signed up and payment recorded successfully.",
      studentId: student.id,
      payment,
    });
  } catch (error) {
    await t.rollback();
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

exports.login = (req, res, next) => {
  const username = req.body.username;
  const password = req.body.password;
  let loggedIn;
  Student.findOne({ where: { username: username } })

    .then((user) => {
      if (!user) {
        const error = new Error("Student with this username not found.!");
        error.statusCode = 401;
        throw error;
      }
      loggedIn = user;
      return bcrypt.compare(password, user.password);
    })
    .then((isEqual) => {
      if (!isEqual) {
        const error = new Error("Password doen't match.");
        error.statusCode = 401;
        throw error;
      }
      const token = jwt.sign(
        {
          email:    loggedIn.email,
          userId:   loggedIn.id.toString(),
          userType: 'STUDENT',
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.status(200).json({
        token,
        user: {
          id: String(loggedIn.id),
          email: loggedIn.email || null,
          username: loggedIn.username,
          role: { id: 'student', name: 'STUDENT', description: null, isSystem: true, isActive: true },
          permissions: [],
          isActive: true,
          profileImg: loggedIn.profileImg || null,
          shift: loggedIn.shift || null,
          timeZone: loggedIn.timeZone || null,
        },
      });
    })

    .catch((err) => {
      if (!err?.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.delete = async (req, res, next) => {
  const studentId = req.params.studentId;
  const t = await sequelize.transaction();
  try {
    const student = await Student.findByPk(studentId);
    if (!student) {
      const error = new Error("Student not found!");
      error.statusCode = 404;
      throw error;
    }

    // Delete leaf records first (those that depend on ClassSession or other children)
    await SessionFeedback.destroy({ where: { studentId }, transaction: t });
    await Survey.destroy({ where: { studentId }, transaction: t });
    await Resource.destroy({ where: { studentId }, transaction: t });
    await Attendance.destroy({ where: { studentId }, transaction: t });
    await QuizAttempt.destroy({ where: { studentId }, transaction: t });
    await SubmittedAssignment.destroy({ where: { studentId }, transaction: t });
    await Fee.destroy({ where: { studentId }, transaction: t });
    await PlanChangeRequest.destroy({ where: { studentId }, transaction: t });
    await Payment.destroy({ where: { studentId }, transaction: t });
    await MyBookmark.destroy({ where: { studentId }, transaction: t });
    await AdminFeedback.destroy({ where: { studentId }, transaction: t });
    await MakeUpClass.destroy({ where: { studentId }, transaction: t });
    await StudentFeedback.destroy({ where: { studentId }, transaction: t });
    await UpcomingClass.destroy({ where: { studentId }, transaction: t });
    await TeacherStudent.destroy({ where: { studentId }, transaction: t });
    await EnrolledStudents.destroy({ where: { studentId }, transaction: t });

    // ClassSession / ClassSchedule: nullify studentId (they may belong to other students too)
    await ClassSession.update({ studentId: null }, { where: { studentId }, transaction: t });
    await ClassSchedule.update({ studentId: null }, { where: { studentId }, transaction: t });

    // UpcomingCourses: nullable studentId — just nullify
    await UpcomingCourses.update({ studentId: null }, { where: { studentId }, transaction: t });

    // Quiz: nullable studentId — just nullify
    await Quiz.update({ studentId: null }, { where: { studentId }, transaction: t });

    // CourseDetails.studentId is NOT NULL, so we must delete those rows.
    // First nullify courseDetailsId FKs on records that reference them but must be preserved.
    const courseDetailsList = await CourseDetails.findAll({
      where: { studentId },
      attributes: ['id'],
      transaction: t,
    });
    if (courseDetailsList.length > 0) {
      const courseDetailsIds = courseDetailsList.map((cd) => cd.id);
      await ClassSchedule.update({ courseDetailsId: null }, { where: { courseDetailsId: { [Op.in]: courseDetailsIds } }, transaction: t });
      await ClassSession.update({ courseDetailsId: null }, { where: { courseDetailsId: { [Op.in]: courseDetailsIds } }, transaction: t });
      await CourseDetails.destroy({ where: { studentId }, transaction: t });
    }

    await student.destroy({ transaction: t });
    await t.commit();
    res.status(200).json({ message: "Student Deleted Successfully" });
  } catch (err) {
    await t.rollback();
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.update = (req, res, next) => {
  const { studentId } = req.params;

  // IDOR check: non-admins can only update their own record
  if (req.userType !== 'ADMIN' && req.userType !== 'SUPER_ADMIN') {
    if (String(req.userId) !== String(studentId)) {
      const error = new Error('Forbidden: you can only update your own profile.');
      error.statusCode = 403;
      return next(error);
    }
  }
  const {
    username,
    firstName,
    lastName,
    password,
    contact,
    address,
    dateOfBirth,
    guardian,
    emergencyContact,
    countryName,
    state,
    city,
    timeZone,
    flexibleHours,
    suitableHours,
    nameForTeacher,
    planId,
    shift,
  } = req.body;

  let updateFields = {};
  if (username) {
    updateFields.username = username;
  }
  if (firstName) {
    updateFields.firstName = firstName;
  }
  if (lastName) {
    updateFields.lastName = lastName;
  }
  if (password) {
    // Hash the new password before updating
    bcrypt.hash(password, 12).then((hashPwd) => {
      updateFields.password = hashPwd;
    });
  }
  if (contact) {
    updateFields.contact = contact;
  }
  if (address) {
    updateFields.address = address;
  }
  if (dateOfBirth) {
    updateFields.dateOfBirth = dateOfBirth;
  }
  if (guardian) {
    updateFields.guardian = guardian;
  }
  if (emergencyContact) {
    updateFields.emergencyContact = emergencyContact;
  }
  if (countryName) {
    updateFields.countryName = countryName;
  }
  if (state) {
    updateFields.state = state;
  }
  if (city) {
    updateFields.city = city;
  }
  if (timeZone) {
    updateFields.timeZone = timeZone;
  }
  if (flexibleHours) {
    updateFields.flexibleHours = flexibleHours;
  }
  if (suitableHours) {
    updateFields.suitableHours = suitableHours;
  }
  if (nameForTeacher) {
    updateFields.nameForTeacher = nameForTeacher;
  }
  if (planId) {
    updateFields.planId = planId;
  }
  if (shift !== undefined) {
    updateFields.shift = shift || null;
  }

  Student.findByPk(studentId)
    .then((student) => {
      if (!student) {
        const error = new Error("Student not found!");
        error.statusCode = 404;
        throw error;
      }
      return student.update(updateFields);
    })
    .then((updatedStudent) => {
      res.status(200).json({
        message: "Student updated successfully!",
        student: updatedStudent,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.uploadImage = async (req, res, next) => {
  const { studentId } = req.body;
  // console.log("student Id is::", teacherId, req.file);
  try {
    if (!req.file) {
      const error = new Error("No image provided.");
      error.statusCode = 422;
      throw error;
    }

    const imageUrl = req.file.path.replace("\\", "/");
    const student = await Student.findByPk(studentId);

    if (!student) {
      const error = new Error("Student not found.");
      error.statusCode = 404;
      throw error;
    }
    student.profileImg = imageUrl;
    await student.save();

    res
      .status(200)
      .json({ message: "Image uploaded successfully", imageUrl: imageUrl });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getProfileImage = async (req, res, next) => {
  const { studentId } = req.params;
  try {
    const student = await Student.findByPk(studentId);

    if (!student) {
      const error = new Error("Student not found.");
      error.statusCode = 404;
      throw error;
    }

    if (!student.profileImg) {
      const error = new Error("No image found for this student.");
      error.statusCode = 404;
      throw error;
    }

    const imagePath = student.profileImg;
    res.status(200).json({ imageUrl: imagePath });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getAllStudents = (req, res, next) => {
  Student.findAll()
    .then((students) => {
      res.status(200).json({ students: students });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};
exports.getStudentById = (req, res, next) => {
  const studentId = req.params.studentId;

  Student.findByPk(studentId)
    .then((student) => {
      if (!student) {
        const error = new Error("Student not found!");
        error.statusCode = 404;
        throw error;
      }
      res.status(200).json({ student: student });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.getStudentByUsername = (req, res, next) => {
  const { username } = req.body;

  Student.findOne({ where: { username: username } })
    .then((student) => {
      if (!student) {
        const error = new Error("Student not found!");
        error.statusCode = 404;
        throw error;
      }
      res.status(200).json({ student: student });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

//dashboard

// Function to calculate course completion based on start date and duration
const getCourseCompletion = (courseStartDate, courseDuration) => {
  const today = new Date();
  const startDate = new Date(courseStartDate);
  const timeDiff = today - startDate; // Time difference in milliseconds
  const daysPassed = Math.floor(timeDiff / (1000 * 60 * 60 * 24)); // Convert milliseconds to days

  if (courseDuration) {
    // Calculate percentage based on duration
    const completionPercentage = (daysPassed / courseDuration) * 100;
    return completionPercentage > 100 ? 100 : completionPercentage;
  } else {
    // If no duration, apply custom completion rules
    let completionPercentage = 0;

    if (daysPassed <= 50) {
      completionPercentage = daysPassed; // 1% per day for the first 50 days
    } else {
      completionPercentage = 50 + (daysPassed - 50) * 0.5; // 0.5% per day after 50 days
    }

    return completionPercentage > 100 ? 100 : completionPercentage;
  }
};

// Controller function for getting dashboard data
exports.getDashboardData = (req, res, next) => {
  const { studentId } = req.params;

  // Find all courses assigned to the student
  CourseDetails.findAll({
    where: { studentId },
    include: [
      {
        model: Courses,
      },
    ],
  })
    .then((courses) => {
      if (!courses || courses.length === 0) {
        const error = new Error("No courses found for this student!");
        error.statusCode = 404;
        throw error;
      }

      // Calculate completion for each course
      const courseCompletion = courses.map((course) => ({
        courseId: course.id,
        courseName: course.courseName,
        completion: getCourseCompletion(course.createdAt, course.duration), // Assuming createdAt is the course start date
      }));

      res.status(200).json({
        studentId: studentId,
        courseCompletion: courseCompletion,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.getAssessmentScore = async (req, res, next) => {
  const studentId = req.params.studentId;

  try {
    // Fetch the student
    const student = await Student.findByPk(studentId);
    if (!student) {
      const error = new Error("Student not found!");
      error.statusCode = 404;
      throw error;
    }

    // Fetch quizzes and attempts by the student
    const quizAttempts = await QuizAttempt.findAll({
      where: { studentId },
      include: [{ model: Quiz, attributes: ["title", "passingScore"] }],
    });

    // Calculate quiz score
    const totalQuizMaxScore = quizAttempts.reduce(
      (sum, attempt) => sum + 100,
      0
    );
    const totalQuizObtainedScore = quizAttempts.reduce(
      (sum, attempt) => sum + (attempt.score || 0),
      0
    );
    // console.log("quiz scre::",totalQuizMaxScore);
    const quizScorePercentage =
      totalQuizMaxScore > 0
        ? (totalQuizObtainedScore / totalQuizMaxScore) * 100
        : 0;

    // Fetch assignments and submitted assignments by the student
    const submittedAssignments = await SubmittedAssignment.findAll({
      where: { studentId },
      include: [{ model: Assignment, attributes: ["title", "maxScore"] }],
    });

    // Calculate assignment score
    const totalAssignmentMaxScore = submittedAssignments.reduce(
      (sum, subAssignment) => sum + subAssignment.Assignment.maxScore,
      0
    );
    const totalAssignmentObtainedScore = submittedAssignments.reduce(
      (sum, subAssignment) => sum + (subAssignment.score || 0),
      0
    );
    const assignmentScorePercentage =
      totalAssignmentMaxScore > 0
        ? (totalAssignmentObtainedScore / totalAssignmentMaxScore) * 100
        : 0;

    // Placeholder for participation score (can be calculated based on custom logic like attendance, engagement, etc.)
    const totalAttendance = await Attendance.count({ where: { studentId } }); // Placeholder value
    const participationScore = await Attendance.count({
      where: { studentId, status: "Present" },
    }); // Placeholder value
    // console.log("attendance::",totalAttendance,participationScore);
    // Response with assessment scores
    const assessmentScores = {
      assignments: { score: assignmentScorePercentage, maxScore: 100 },
      quizes: { score: quizScorePercentage, maxScore: 100 },
      participation: {
        score:
          totalAttendance > 0
            ? (participationScore / totalAttendance) * 100
            : 0,
        maxScore: 100,
      },
    };

    const badges = [];
    const fast_learner =
      assessmentScores.participation.score >= 90 && quizScorePercentage >= 90;
    const team_player = assignmentScorePercentage >= 90;
    const problem_solver = quizScorePercentage >= 90;

    if (fast_learner) {
      badges.push("fast_learner");
    }
    if (team_player) {
      badges.push("team_player");
    }
    if (problem_solver) {
      badges.push("problem_solver");
    }
    if (fast_learner && team_player && problem_solver) {
      badges.push("top_performer");
    }
    // Send the response student,
    res.status(200).json({ assessmentScores, badges });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// Leaderboard
exports.getLeaderboard = async (req, res, next) => {
  try {
    // Step 1: Fetch all students
    const students = await Student.findAll({
      attributes: ["id", "firstName"], // Assuming students have an 'id' and 'name' field
    });

    // Step 2: Fetch quiz attempts, assignment submissions, and attendance records for all students
    const quizAttempts = await QuizAttempt.findAll({
      attributes: ["studentId", "score"],
    });

    const submittedAssignments = await SubmittedAssignment.findAll({
      attributes: ["studentId", "score"],
    });

    const attendances = await Attendance.findAll({});

    // Step 3: Create a map to accumulate the scores for each student
    const studentScores = {};

    students.forEach((student) => {
      studentScores[student.id] = {
        studentId: student.id,
        studentName: student.name,
        totalScore: 0,
      };
    });

    // Step 4: Accumulate quiz scores
    quizAttempts.forEach((attempt) => {
      if (studentScores[attempt.studentId]) {
        studentScores[attempt.studentId].totalScore += attempt.score || 0;
      }
    });

    // Step 5: Accumulate assignment scores
    submittedAssignments.forEach((submission) => {
      if (studentScores[submission.studentId]) {
        studentScores[submission.studentId].totalScore += submission.score || 0;
      }
    });

    // Step 6: Accumulate attendance scores
    for (const attendance of attendances) {
      if (studentScores[attendance.studentId]) {
        // Calculate attendance
        const totalAttendance = await Attendance.count({
          where: { studentId: attendance.studentId },
        });
        const participationScore = await Attendance.count({
          where: { studentId: attendance.studentId, status: "Present" },
        });
        const totalAttendanceScore =
          (participationScore / totalAttendance) * 100;

        // Add to total score (since you don't have attendanceScore, you add calculated attendance)
        studentScores[attendance.studentId].totalScore +=
          totalAttendanceScore || 0;
      }
    }

    // Step 7: Convert the studentScores object to an array and sort it by totalScore
    const leaderboard = Object.values(studentScores).sort(
      (a, b) => b.totalScore - a.totalScore
    );

    // Step 8: Send the sorted leaderboard as a response
    res.status(200).json({ leaderboard });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getUpcomingClasses = async (req, res, next) => {
  const { studentId } = req.params;
  try {
    const upcomingClasses = await UpcomingClass.findAll({
      where: {
        studentId: studentId,
      },
      include: [
        {
          model: Student,
          attributes: ["id", "firstName", "lastName", "profileImg"],
        },
      ],
      order: [["time", "ASC"]],
      limit: 50,
    });
    res.status(200).json({ upcomingClasses });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.countAllStudents = (req, res, next) => {
  Student.count()
    .then((totalStudents) => {
      res.status(200).json({ totalStudents });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.countRecentStudents = (req, res, next) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  Student.count({
    where: {
      createdAt: {
        [Op.gte]: thirtyDaysAgo,
      },
    },
  })
    .then((count) => {
      res.status(200).json({ totalRecentStudents: count });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.getDashboardStats = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    // Enrolled courses
    const enrolledCourses = await CourseDetails.count({ where: { studentId } });

    // Pending assignments: submissions that haven't been submitted yet
    const pendingAssignments = await SubmittedAssignment.count({
      where: { studentId, status: { [Op.in]: ['Not Started', 'In Progress'] } },
    });

    // Upcoming quizzes: active quizzes assigned to this student
    const upcomingQuizzes = await Quiz.count({
      where: { studentId, status: 'active' },
    });

    // Attendance rate
    const totalAttendance = await Attendance.count({ where: { studentId } });
    const presentAttendance = await Attendance.count({ where: { studentId, status: 'Present' } });
    const attendanceRate = totalAttendance > 0
      ? Math.round((presentAttendance / totalAttendance) * 100)
      : 0;

    res.status(200).json({
      enrolledCourses,
      pendingAssignments,
      upcomingQuizzes,
      attendanceRate,
    });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};
