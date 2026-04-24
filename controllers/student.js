const { validationResult } = require("express-validator");
const { parse: parseCSV } = require("csv-parse/sync");
const XLSX = require("xlsx");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Role = require("../models/Roles");
const Rights = require("../models/Rights");
const AdminRights = require("../models/AdminRights");
const Teacher = require("../models/Teacher");
const Parent = require("../models/Parent");
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
    classTime,
    newClassTime,
    nameForTeacher,
    teacherId,
    courseId,
    shift,
    enrollmentChannel,
    referenceDetails,
    studentLabel,
    struckOffReason,
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
      classTime,
      newClassTime,
      nameForTeacher,
      shift: shift || null,
      enrollmentChannel: enrollmentChannel || null,
      referenceDetails: enrollmentChannel === 'Reference' ? (referenceDetails || null) : null,
      studentLabel: studentLabel || null,
      struckOffReason: studentLabel === 'Struck off' ? (struckOffReason || null) : null,
    }, { transaction: t });

    // Step 4: Assign teacher if provided (TeacherStudent M2M)
    if (teacherId) {
      await TeacherStudent.create({ TeacherId: teacherId, StudentId: student.id }, { transaction: t });
    }

    // Step 5: Assign course if provided (CourseDetails enrollment)
    if (courseId) {
      const existing = await CourseDetails.findOne({ where: { studentId: student.id, courseId }, transaction: t });
      if (!existing) {
        await CourseDetails.create({ studentId: student.id, courseId, teacherId: teacherId || null }, { transaction: t });
      }
    }

    // Step 6: Record the payment (use custom amount if provided, otherwise plan price)
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
        { expiresIn: "8h" }
      );

      res.status(200).json({
        token,
        user: {
          id: String(loggedIn.id),
          email: loggedIn.email || null,
          username: loggedIn.username,
          userType: 'STUDENT',
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

exports.update = async (req, res, next) => {
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
    classTime,
    newClassTime,
    nameForTeacher,
    teacherId,
    courseId,
    planId,
    shift,
    enrollmentChannel,
    referenceDetails,
    studentLabel,
    struckOffReason,
  } = req.body;

  let updateFields = {};
  if (username) {
    // Check that the new username isn't taken by any existing user (excluding current student)
    const current = await Student.findByPk(studentId, { attributes: ['username'] });
    if (!current || username.trim() !== current.username) {
      const [existingTeacher, existingStudent, existingParent, existingAdmin] = await Promise.all([
        Teacher.findOne({ where: { username } }),
        Student.findOne({ where: { username, id: { [Op.ne]: studentId } } }),
        Parent.findOne({ where: { username } }),
        Admin.findOne({ where: { username } }),
      ]);
      if (existingTeacher || existingStudent || existingParent || existingAdmin) {
        return res.status(409).json({ message: 'Username is already taken.' });
      }
    }
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
  if (classTime) {
    updateFields.classTime = classTime;
  }
  if (newClassTime) {
    updateFields.newClassTime = newClassTime;
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
  if (enrollmentChannel !== undefined) {
    updateFields.enrollmentChannel = enrollmentChannel || null;
  }
  if (enrollmentChannel !== undefined || referenceDetails !== undefined) {
    const channel = enrollmentChannel !== undefined ? enrollmentChannel : null;
    if (channel === 'Reference') {
      updateFields.referenceDetails = referenceDetails || null;
    } else if (channel !== undefined) {
      updateFields.referenceDetails = null;
    } else if (referenceDetails !== undefined) {
      updateFields.referenceDetails = referenceDetails || null;
    }
  }
  if (studentLabel !== undefined) {
    updateFields.studentLabel = studentLabel || null;
    updateFields.struckOffReason = studentLabel === 'Struck off' ? (struckOffReason || null) : null;
  }

  try {
    const student = await Student.findByPk(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found!" });
    }
    const updatedStudent = await student.update(updateFields);

    // Handle teacher assignment change (TeacherStudent M2M)
    if (teacherId !== undefined) {
      await TeacherStudent.destroy({ where: { StudentId: studentId } });
      if (teacherId) {
        await TeacherStudent.create({ TeacherId: teacherId, StudentId: studentId });
      }
    }

    // Handle course assignment change (CourseDetails enrollment)
    if (courseId !== undefined) {
      // Remove all existing CourseDetails for this student (simple: one course per student in admin form)
      await CourseDetails.destroy({ where: { studentId } });
      if (courseId) {
        await CourseDetails.create({ studentId, courseId, teacherId: teacherId || null });
      }
    }

    res.status(200).json({ message: "Student updated successfully!", student: updatedStudent });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
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

exports.getAllStudents = async (req, res, next) => {
  try {
    const students = await Student.findAll({
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Plan,
          attributes: ['id', 'name'],
          required: false,
        },
        {
          model: Teacher,
          through: { attributes: [] },
          attributes: ['id', 'firstName', 'lastName', 'imageUrl'],
          required: false,
        },
        {
          model: Parent,
          as: 'Parent',
          attributes: ['id', 'firstName', 'lastName', 'profileImg'],
          required: false,
        },
        {
          model: CourseDetails,
          attributes: ['id', 'courseId'],
          required: false,
          include: [
            {
              model: Courses,
              attributes: ['id', 'courseName'],
              required: false,
            },
          ],
        },
        {
          model: Fee,
          attributes: ['id', 'status'],
          required: false,
        },
      ],
    });

    // Normalize each student for the frontend
    const normalized = students.map((s) => {
      const raw = s.toJSON();

      // Teacher: first assigned teacher
      const teacher = raw.Teachers && raw.Teachers.length > 0 ? raw.Teachers[0] : null;

      // Course: first enrolled course
      const firstCourseDetails = raw.CourseDetails && raw.CourseDetails.length > 0 ? raw.CourseDetails[0] : null;
      const course = firstCourseDetails?.Course?.courseName ?? null;
      const courseId = firstCourseDetails?.courseId ?? null;
      const courseDetailsId = firstCourseDetails?.id ?? null;

      // Fee status: any pending/overdue → "unpaid"; all paid → "paid"; none → "none"
      let feeStatus = 'none';
      if (raw.Fees && raw.Fees.length > 0) {
        const hasUnpaid = raw.Fees.some((f) => f.status === 'pending' || f.status === 'overdue');
        feeStatus = hasUnpaid ? 'unpaid' : 'paid';
      }

      return {
        ...raw,
        // Format TIME fields from HH:MM:SS to HH:MM for <input type="time"> compatibility
        classTime: raw.classTime ? raw.classTime.substring(0, 5) : raw.classTime,
        newClassTime: raw.newClassTime ? raw.newClassTime.substring(0, 5) : raw.newClassTime,
        plan: raw.Plan || null,
        assignedTeacher: teacher,
        parent: raw.Parent || null,
        courseName: course,
        courseId,
        courseDetailsId,
        feeStatus,
        isAssigned: !!(teacher),
        // clean up Sequelize association keys
        Plan: undefined,
        Teachers: undefined,
        Parent: undefined,
        CourseDetails: undefined,
        Fees: undefined,
      };
    });

    res.status(200).json({ students: normalized });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.toggleStatus = async (req, res, next) => {
  const { studentId } = req.params;
  try {
    const student = await Student.findByPk(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found.' });
    const newStatus = student.status === 'active' ? 'inactive' : 'active';
    await student.update({ status: newStatus });
    res.status(200).json({ message: 'Status updated.', status: newStatus, id: student.id });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
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
      const raw = student.toJSON();
      // Format TIME fields from HH:MM:SS to HH:MM for <input type="time"> compatibility
      if (raw.classTime) raw.classTime = raw.classTime.substring(0, 5);
      if (raw.newClassTime) raw.newClassTime = raw.newClassTime.substring(0, 5);
      res.status(200).json({ student: raw });
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

exports.getMyTeachers = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    // Derive teachers from CourseDetails — the same source the detail view uses,
    // so the list and detail view are always in sync.
    const courseDetails = await CourseDetails.findAll({
      where: { studentId },
      include: [{
        model: Teacher,
        attributes: ['id', 'firstName', 'lastName', 'email', 'imageUrl', 'shift'],
      }],
    });

    // Deduplicate: a teacher may have multiple CourseDetails rows with this student
    const teacherMap = new Map();
    for (const cd of courseDetails) {
      if (cd.Teacher && !teacherMap.has(cd.Teacher.id)) {
        teacherMap.set(cd.Teacher.id, cd.Teacher);
      }
    }

    res.status(200).json({ teachers: Array.from(teacherMap.values()) });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
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

// ─── Bulk Import Students ─────────────────────────────────────────────────────
// POST /api/student/bulk-import
// Accepts a multipart .xlsx or .csv file (field name: "file").
// Reads the "Student Data" sheet for xlsx, the whole file for csv.
// Validates each row, skips bad rows, returns { imported, failed[] }.
exports.countryStats = async (req, res, next) => {
  try {
    const rows = await Student.findAll({
      attributes: [
        'countryName',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
      ],
      where: { countryName: { [Op.not]: null, [Op.ne]: '' } },
      group: ['countryName'],
      order: [[Sequelize.literal('count'), 'DESC']],
      raw: true,
    });
    return res.json({ countries: rows.map(r => ({ country: r.countryName, count: Number(r.count) })) });
  } catch (err) {
    next(err);
  }
};

exports.bulkImport = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded." });
  }

  const ext = require("path").extname(req.file.originalname).toLowerCase();
  let rows;

  try {
    if (ext === ".xlsx") {
      // ── Parse Excel ──────────────────────────────────────────────────────
      const workbook = XLSX.readFile(req.file.path);

      // Always read from the "Student Data" sheet (index 1); fall back to first sheet
      const sheetName = workbook.SheetNames.includes("Student Data")
        ? "Student Data"
        : workbook.SheetNames[0];

      const worksheet = workbook.Sheets[sheetName];
      // { defval: "" } so missing cells come back as empty strings, not undefined
      rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    } else {
      // ── Parse CSV ────────────────────────────────────────────────────────
      const fileBuffer = req.file.buffer || require("fs").readFileSync(req.file.path);
      rows = parseCSV(fileBuffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    }
  } catch (parseErr) {
    return res.status(422).json({ success: false, message: `File parse error: ${parseErr.message}` });
  }

  if (!rows || rows.length === 0) {
    return res.status(422).json({ success: false, message: "The file is empty or has no data rows." });
  }

  const VALID_SHIFTS         = ["Morning", "Afternoon", "Evening"];
  const VALID_LABELS         = ["Unassigned", "Trial", "New Enrollment", "Lost", "Struck off"];
  const VALID_CHANNELS       = ["Meta", "Google", "TikTok", "SEO", "Email", "Reference"];
  const EMAIL_RE             = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const importedStudents = [];
  const failed = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +1 for header row, +1 for 1-based index

    // ── Required field validation ───────────────────────────────────────────
    if (!row.firstName || !row.firstName.trim()) {
      failed.push({ row: rowNum, reason: "firstName is required." });
      continue;
    }
    if (!row.username || !row.username.trim()) {
      failed.push({ row: rowNum, reason: "username is required." });
      continue;
    }
    if (!row.password || row.password.trim().length < 6) {
      failed.push({ row: rowNum, reason: "password is required and must be at least 6 characters." });
      continue;
    }
    if (!row.planId || isNaN(parseInt(row.planId, 10))) {
      failed.push({ row: rowNum, reason: "planId is required and must be a number." });
      continue;
    }

    // ── Optional enum validation ────────────────────────────────────────────
    if (row.shift && !VALID_SHIFTS.includes(row.shift)) {
      failed.push({ row: rowNum, reason: `shift must be one of: ${VALID_SHIFTS.join(", ")}.` });
      continue;
    }
    if (row.studentLabel && !VALID_LABELS.includes(row.studentLabel)) {
      failed.push({ row: rowNum, reason: `studentLabel must be one of: ${VALID_LABELS.join(", ")}.` });
      continue;
    }
    if (row.enrollmentChannel && !VALID_CHANNELS.includes(row.enrollmentChannel)) {
      failed.push({ row: rowNum, reason: `enrollmentChannel must be one of: ${VALID_CHANNELS.join(", ")}.` });
      continue;
    }
    if (row.email && row.email.trim() && !EMAIL_RE.test(row.email.trim())) {
      failed.push({ row: rowNum, reason: "email format is invalid." });
      continue;
    }

    // ── Username uniqueness check ───────────────────────────────────────────
    try {
      const existing = await Student.findOne({ where: { username: row.username.trim() } });
      if (existing) {
        failed.push({ row: rowNum, reason: `Username "${row.username.trim()}" already exists.` });
        continue;
      }
    } catch (dbErr) {
      failed.push({ row: rowNum, reason: `DB error checking username: ${dbErr.message}` });
      continue;
    }

    // ── Plan check ─────────────────────────────────────────────────────────
    let plan;
    try {
      plan = await Plan.findByPk(parseInt(row.planId, 10));
      if (!plan) {
        failed.push({ row: rowNum, reason: `Plan with id ${row.planId} not found.` });
        continue;
      }
    } catch (dbErr) {
      failed.push({ row: rowNum, reason: `DB error checking plan: ${dbErr.message}` });
      continue;
    }

    // ── Create student ─────────────────────────────────────────────────────
    try {
      const hashedPwd = await bcrypt.hash(row.password.trim(), 12);
      const student = await Student.create({
        firstName:        row.firstName.trim(),
        lastName:         row.lastName?.trim() || null,
        username:         row.username.trim(),
        password:         hashedPwd,
        email:            row.email?.trim() || null,
        contact:          row.contact?.trim() || null,
        address:          row.address?.trim() || null,
        dateOfBirth:      row.dateOfBirth?.trim() || null,
        guardian:         row.guardian?.trim() || null,
        emergencyContact: row.emergencyContact?.trim() || null,
        countryName:      row.countryName?.trim() || null,
        state:            row.state?.trim() || null,
        city:             row.city?.trim() || null,
        timeZone:         row.timeZone?.trim() || null,
        classTime:    row.classTime?.trim() || null,
        newClassTime:    row.newClassTime?.trim() || null,
        nameForTeacher:   row.nameForTeacher?.trim() || null,
        shift:            row.shift?.trim() || null,
        studentLabel:     row.studentLabel?.trim() || null,
        struckOffReason:  row.studentLabel?.trim() === "Struck off" ? (row.struckOffReason?.trim() || null) : null,
        enrollmentChannel: row.enrollmentChannel?.trim() || null,
        referenceDetails:  row.enrollmentChannel?.trim() === "Reference" ? (row.referenceDetails?.trim() || null) : null,
        planId:           parseInt(row.planId, 10),
        parentId:         row.parentId && !isNaN(parseInt(row.parentId, 10)) ? parseInt(row.parentId, 10) : null,
      });

      // Record payment for plan purchase
      await Payment.create({
        studentId: student.id,
        amount:    plan.price,
        purpose:   "Plan Purchase",
      });

      importedStudents.push(student.id);
    } catch (createErr) {
      failed.push({ row: rowNum, reason: createErr.message });
    }
  }

  return res.status(200).json({
    success: true,
    imported: importedStudents.length,
    failed,
  });
};

exports.topStudents = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const { QueryTypes } = require('sequelize');
    const rows = await sequelize.query(
      `SELECT
         s.id,
         s.firstName,
         s.lastName,
         s.profileImg,
         COALESCE(SUM(CASE WHEN f.status = 'paid' THEN f.amount ELSE 0 END), 0) AS totalPaid,
         COUNT(DISTINCT cd.id) AS courseCount
       FROM Students s
       LEFT JOIN Fees f ON f.studentId = s.id
       LEFT JOIN CourseDetails cd ON cd.studentId = s.id
       GROUP BY s.id, s.firstName, s.lastName, s.profileImg
       ORDER BY totalPaid DESC
       LIMIT :limit`,
      { replacements: { limit }, type: QueryTypes.SELECT }
    );
    const students = rows.map(r => ({
      id:          r.id,
      firstName:   r.firstName,
      lastName:    r.lastName,
      profileImg:  r.profileImg,
      totalPaid:   Number(r.totalPaid),
      courseCount: Number(r.courseCount),
    }));
    return res.json({ students });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};
