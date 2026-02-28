const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Role = require("../models/Roles");
const Rights = require("../models/Rights");
const AdminRights = require("../models/AdminRights");
const Teacher = require("../models/Teacher");
const { Op, Sequelize } = require("sequelize");
const Student = require("../models/Student");
const CourseDetails = require("../models/CourseDetails");
const { QuizAttempt, SubmittedAssignment, Assignment, Quiz, Attendance, UpcomingClass, Courses } = require("../models/association");
const Parent = require("../models/Parent");

exports.signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ message: "Validation failed.", data: errors.array() });
  }

  const { username, firstName, lastName, password, contact, email, address } = req.body;
  // Accept studentIds as an array (one parent → many students)
  const studentIds = Array.isArray(req.body.studentIds)
    ? req.body.studentIds
    : req.body.studentId
    ? [req.body.studentId]  // backwards-compat: single id
    : [];

  try {
    const hashPwd = await bcrypt.hash(password, 12);
    const parent = await Parent.create({
      username, firstName, lastName, contact, email, password: hashPwd, address,
    });

    // Set parentId on each linked student
    if (studentIds.length > 0) {
      await Student.update({ parentId: parent.id }, { where: { id: studentIds } });
    }

    res.status(200).json({ message: "Parent saved successfully!", userId: parent.id });
  } catch (err) {
    if (!err?.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.login = (req, res, next) => {
  const username = req.body.username;
  const password = req.body.password;
  let loggedIn;
  Parent.findOne({ where: { username: username } })

    .then((user) => {
      if (!user) {
        const error = new Error("Parent with this username not found.!");
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
          email: loggedIn.email,
          userId: loggedIn.id.toString(),
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
          role: { id: 'parent', name: 'PARENT', description: null, isSystem: true, isActive: true },
          permissions: [],
          isActive: true,
          profileImg: loggedIn.profileImg || null,
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
  const parentId = req.params.parentId;
  try {
    const parent = await Parent.findByPk(parentId);
    if (!parent) {
      const error = new Error("Parent not found!");
      error.statusCode = 404;
      throw error;
    }
    // Unlink students before deleting to avoid FK constraint error
    await Student.update({ parentId: null }, { where: { parentId } });
    await parent.destroy();
    res.status(200).json({ message: "Parent Deleted Successfully" });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.update = async (req, res, next) => {
  const { parentId } = req.params;
  const { firstName, lastName, contact, address, emergencyContact, studentIds } = req.body;

  try {
    const parent = await Parent.findByPk(parentId);
    if (!parent) {
      return res.status(404).json({ message: "Parent not found!" });
    }

    const updateFields = {};
    if (firstName !== undefined) updateFields.firstName = firstName;
    if (lastName !== undefined) updateFields.lastName = lastName;
    if (contact !== undefined) updateFields.contact = contact;
    if (address !== undefined) updateFields.address = address;
    if (emergencyContact !== undefined) updateFields.emergencyContact = emergencyContact;

    await parent.update(updateFields);

    // Update student links if studentIds was sent in the request
    if (studentIds !== undefined) {
      const ids = Array.isArray(studentIds) ? studentIds : [];
      // Unlink all students currently linked to this parent
      await Student.update({ parentId: null }, { where: { parentId: parent.id } });
      // Link the new set of students
      if (ids.length > 0) {
        await Student.update({ parentId: parent.id }, { where: { id: ids } });
      }
    }

    // Return the parent with its freshly linked students
    const updatedParent = await Parent.findByPk(parentId, {
      include: [{ model: Student, as: 'students', attributes: ['id', 'firstName', 'lastName', 'username', 'email', 'status'] }],
    });

    res.status(200).json({ message: "Parent updated successfully!", parent: updatedParent });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.uploadImage = async (req, res, next) => {

  const { parentId } = req.body;
  // console.log("student Id is::", teacherId, req.file);
  try {
    if (!req.file) {
      const error = new Error("No image provided.");
      error.statusCode = 422;
      throw error;
    }

    const imageUrl = req.file.path.replace("\\", "/");
    const parent = await Parent.findByPk(parentId);

    if (!parent) {
      const error = new Error("Parent not found.");
      error.statusCode = 404;
      throw error;
    }
    parent.profileImg = imageUrl;
    await parent.save();

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
  const {parentId} = req.params;
  try {
    const parent = await Parent.findByPk(parentId);

    if (!parent) {
      const error = new Error("Student not found.");
      error.statusCode = 404;
      throw error;
    }

    if (!parent.profileImg) {
      const error = new Error("No image found for this parent.");
      error.statusCode = 404;
      throw error;
    }

    const imagePath = parent.profileImg;
    res.status(200).json({ imageUrl: imagePath });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};


exports.getAllParents = async (req, res, next) => {
  try {
    const parents = await Parent.findAll({
      include: [{
        model: Student,
        as: 'students',
        attributes: ['id', 'firstName', 'lastName', 'username', 'email', 'status'],
      }],
    });
    res.status(200).json({ parents });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.getParentById = async (req, res, next) => {
  const parentId = req.params.parentId;
  try {
    const parent = await Parent.findByPk(parentId, {
      include: [{
        model: Student,
        as: 'students',
        attributes: ['id', 'firstName', 'lastName', 'username', 'email', 'status'],
      }],
    });
    if (!parent) {
      return res.status(404).json({ message: "Parent not found!" });
    }
    res.status(200).json({ parent });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
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
  const {studentId} = req.params;

  // Find all courses assigned to the student
  CourseDetails.findAll({
    where: { studentId },
    include:[
      {
      model:Courses
    }]
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
      const error = new Error('Student not found!');
      error.statusCode = 404;
      throw error;
    }

    // Fetch quizzes and attempts by the student
    const quizAttempts = await QuizAttempt.findAll({
      where: { studentId },
      include: [{ model: Quiz, attributes: ['title', 'passingScore'] }]
    });

    // Calculate quiz score
    const totalQuizMaxScore = quizAttempts.reduce((sum, attempt) => sum + 100, 0);
    const totalQuizObtainedScore = quizAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0);
    // console.log("quiz scre::",totalQuizMaxScore);
    const quizScorePercentage = totalQuizMaxScore > 0 ? (totalQuizObtainedScore / totalQuizMaxScore) * 100 : 0;

    // Fetch assignments and submitted assignments by the student
    const submittedAssignments = await SubmittedAssignment.findAll({
      where: { studentId },
      include: [{ model: Assignment, attributes: ['title', 'maxScore'] }]
    });

    // Calculate assignment score
    const totalAssignmentMaxScore = submittedAssignments.reduce((sum, subAssignment) => sum + subAssignment.Assignment.maxScore, 0);
    const totalAssignmentObtainedScore = submittedAssignments.reduce((sum, subAssignment) => sum + (subAssignment.score || 0), 0);
    const assignmentScorePercentage = totalAssignmentMaxScore > 0 ? (totalAssignmentObtainedScore / totalAssignmentMaxScore) * 100 : 0;

    // Placeholder for participation score (can be calculated based on custom logic like attendance, engagement, etc.)
    const totalAttendance = await Attendance.count({where:{studentId}}); // Placeholder value
    const participationScore =await Attendance.count({where:{studentId,status:"Present"}}); // Placeholder value
    // console.log("attendance::",totalAttendance,participationScore);
    // Response with assessment scores
    const assessmentScores = {
      assignments: { score: assignmentScorePercentage, maxScore: 100 },
      quizes: { score: quizScorePercentage, maxScore: 100 },
      participation: { score: totalAttendance > 0 ? (participationScore / totalAttendance)*100 : 0, maxScore: 100 }
    };

    const badges = [];
    const fast_learner = assessmentScores.participation.score >= 90 && quizScorePercentage >= 90;
    const team_player = assignmentScorePercentage >= 90;
    const problem_solver = quizScorePercentage >= 90;

    if(fast_learner){
      badges.push("fast_learner");
    }
    if(team_player){
      badges.push("team_player");
    }
    if(problem_solver){
      badges.push("problem_solver");
    }
    if(fast_learner && team_player && problem_solver ){ 
      badges.push("top_performer");
    }
    // Send the response student,
    res.status(200).json({  assessmentScores,badges });

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
      attributes: ['id', 'firstName'], // Assuming students have an 'id' and 'name' field
    });

    // Step 2: Fetch quiz attempts, assignment submissions, and attendance records for all students
    const quizAttempts = await QuizAttempt.findAll({
      attributes: ['studentId', 'score'],
    });

    const submittedAssignments = await SubmittedAssignment.findAll({
      attributes: ['studentId', 'score'],
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
    const totalAttendance = await Attendance.count({ where: { studentId: attendance.studentId } });
    const participationScore = await Attendance.count({ where: { studentId: attendance.studentId, status: "Present" } });
    const totalAttendanceScore = (participationScore / totalAttendance) * 100;

    // Add to total score (since you don't have attendanceScore, you add calculated attendance)
    studentScores[attendance.studentId].totalScore += totalAttendanceScore || 0;
  }
}

    // Step 7: Convert the studentScores object to an array and sort it by totalScore
    const leaderboard = Object.values(studentScores).sort((a, b) => b.totalScore - a.totalScore);

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
        date: { [Op.gte]: new Date() },
      },
      include: [{ model: Student, attributes: ["id", "firstName", "lastName","profileImg"] }],
      order: [
        ["date", "ASC"],
        ["time", "ASC"],
      ],
      limit: 50,
    });
    res.status(200).json({ upcomingClasses });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};




