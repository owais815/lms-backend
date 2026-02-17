const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const { Op, Sequelize } = require("sequelize");
const Teacher = require("../models/Teacher");
const TeacherStudent = require("../models/TeacherStudent");
const Student = require("../models/Student");
const TeacherQualification = require("../models/TeacherQualifications");
const Specialization = require("../models/TeacherSpecialization");
const StudentFeedback = require("../models/StudentFeedback");
const UpcomingClass = require("../models/UpcomingClasses");
const Courses = require("../models/Course");
const CourseDetails = require("../models/CourseDetails");
const { sendNotifications } = require("../utils/notificationUtil");

exports.signup = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation failed.");
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }
  const username = req.body.username;
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const password = req.body.password;
  const contact = req.body.contact;
  const cnic = req.body.cnic;
  const email = req.body.email;

  bcrypt
    .hash(password, 12)
    .then((hashPwd) => {
      const user = new Teacher({
        username: username,
        firstName: firstName,
        lastName: lastName,
        contact: contact,
        cnic: cnic,
        email: email,
        password: hashPwd,
      });
      return user.save();
    })
    .then((result) => {
      res
        .status(200)
        .json({ message: "Teacher saved successfully.!", userId: result.id });
    })

    .catch((err) => {
      if (!err?.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.login = (req, res, next) => {
  const username = req.body.username;
  const password = req.body.password;
  let loggedIn;
  Teacher.findOne({ where: { username: username } })

    .then((user) => {
      if (!user) {
        const error = new Error("Teacher with this username not found.!");
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
        "supersupersecretsecret",
        { expiresIn: "1h" }
      );

      res.status(200).json({ token: token, userId: loggedIn.id });
    })

    .catch((err) => {
      if (!err?.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

// update Teacher Record
exports.update = (req, res, next) => {
  const teacherId = req.params.teacherId; // Assuming teacherId is passed in the URL params
  const updateFields = {};

  // Extract fields that can be updated from the request body
  const { firstName, lastName, password, contact, cnic } = req.body;

  // Add the update fields to the updateFields object if they are provided
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
  if (cnic) {
    updateFields.cnic = cnic;
  }

  // Find the Teacher record by ID and update the fields
  Teacher.findByPk(teacherId)
    .then((teacher) => {
      if (!teacher) {
        const error = new Error("Teacher not found.");
        error.statusCode = 404;
        throw error;
      }

      // Update the Teacher record with the new field values
      return teacher.update(updateFields);
    })
    .then((updatedTeacher) => {
      // Return success response with the updated Teacher details
      res
        .status(200)
        .json({
          message: "Teacher updated successfully.",
          teacher: updatedTeacher,
        });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

//delete teacher record on Id

exports.delete = (req, res, next) => {
  const teacherId = req.params.teacherId; // Get teacherId from URL params

  // Find the Teacher record by ID and delete it
  Teacher.findByPk(teacherId)
    .then((teacher) => {
      if (!teacher) {
        const error = new Error("Teacher not found.");
        error.statusCode = 404;
        throw error;
      }

      // Delete the Teacher record
      return teacher.destroy();
    })
    .then(() => {
      // Send success response
      res.status(200).json({ message: "Teacher deleted successfully." });
    })
    .catch((err) => {
      // Handle errors
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

// getAllTeachers

exports.getAllTeachers = (req, res, next) => {
  // Query the database to retrieve all teacher records
  Teacher.findAll()
    .then((teachers) => {
      // Send success response with the retrieved teacher records
      res.status(200).json({ teachers: teachers });
    })
    .catch((err) => {
      // Handle errors
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

// get teacher by Id

exports.getTeacherById = (req, res, next) => {
  const teacherId = req.params.teacherId;
  // Query the database to retrieve all teacher records
  Teacher.findOne({ where: { id: teacherId } })
    .then((teacher) => {
      if (!teacher) {
        const error = new Error("Teacher not found.");
        error.statusCode = 404;
        throw error;
      }
      // Send success response with the retrieved teacher records
      res.status(200).json({ teacher: teacher });
    })
    .catch((err) => {
      // Handle errors
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

// get teacher by Username

exports.getTeacherByUsername = (req, res, next) => {
  const { username } = req.body;
  // Query the database to retrieve all teacher records
  Teacher.findOne({ where: { username: username } })
    .then((teacher) => {
      if (!teacher) {
        const error = new Error("Teacher not found.");
        error.statusCode = 404;
        throw error;
      }
      // Send success response with the retrieved teacher records
      res.status(200).json({ teacher: teacher });
    })
    .catch((err) => {
      // Handle errors
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.getAssignedStudents = (req, res, next) => {
  const { teacherId } = req.body;

  TeacherStudent.findAll({
    where: { TeacherId: teacherId },
    attributes: ["StudentId"],
  })
    .then((teacherStudents) => {
      if (teacherStudents.length === 0) {
        const error = new Error("No students found for this teacher.");
        error.statusCode = 404;
        throw error;
      }

      // Extract StudentIds from the associations
      const studentIds = teacherStudents.map((ts) => ts.StudentId);

      // Fetch the actual Student records
      return Student.findAll({
        where: { id: studentIds },
      });
    })
    .then((students) => {
      // Get student IDs to fetch CourseDetails
      const studentIds = students.map((student) => student.id);

      // Fetch the courses assigned to each student
      return CourseDetails.findAll({
        where: { studentId: studentIds,teacherId },
        include: [{ model: Courses }], // Include course details
      }).then((courses) => {
        // Map courses to respective students
        const studentsWithCourses = students.map((student) => {
          const studentCourses = courses.filter(
            (course) => course.studentId === student.id
          );
          return { ...student.toJSON(), courses: studentCourses };
        });

        res.status(200).json({ students: studentsWithCourses });
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};


exports.getAssignedTeachers = (req, res, next) => {
  const { studentId } = req.body;

  // Query the database to retrieve all teacher-student associations for the given teacher
  TeacherStudent.findAll({
    where: { StudentId: studentId },
    attributes: ["TeacherId"],
  })
    .then((teacherStudents) => {
      if (teacherStudents.length === 0) {
        const error = new Error("No teachers found for this student.");
        error.statusCode = 404;
        throw error;
      }

      // Extract ids from the associations
      const teacherIds = teacherStudents.map((ts) => ts.TeacherId);

      // Now fetch the actual Student records
      return Teacher.findAll({
        where: {
          id: teacherIds,
        },
      });
    })
    .then((teachers) => {
      // Send success response with the retrieved students
      res.status(200).json({ teachers: teachers });
    })
    .catch((err) => {
      // Handle errors
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.uploadImage = async (req, res, next) => {
  //body {teacherId,image: file.path}
  const { teacherId } = req.body;
  // console.log("teacher Id is::", teacherId, req.file);
  try {
    if (!req.file) {
      const error = new Error("No image provided.");
      error.statusCode = 422;
      throw error;
    }

    const imageUrl = req.file.path.replace("\\", "/");
    const teacher = await Teacher.findByPk(teacherId);

    if (!teacher) {
      const error = new Error("Teacher not found.");
      error.statusCode = 404;
      throw error;
    }

    teacher.imageUrl = imageUrl;
    await teacher.save();

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
  //{teacherId}
  const teacherId = req.params.teacherId;
  try {
    const teacher = await Teacher.findByPk(teacherId);

    if (!teacher) {
      const error = new Error("Teacher not found.");
      error.statusCode = 404;
      throw error;
    }

    if (!teacher.imageUrl) {
      const error = new Error("No image found for this teacher.");
      error.statusCode = 404;
      throw error;
    }

    const imagePath = teacher.imageUrl;
    res.status(200).json({ imageUrl: imagePath });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

//Teacher Qualifications

exports.createQualification = async (req, res, next) => {
  try {
    const { degree, institution, year, teacherId } = req.body;
    const qualification = await TeacherQualification.create({
      degree,
      institution,
      year,
      teacherId: teacherId,
    });
    res
      .status(201)
      .json({ message: "Qualification created successfully", qualification });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getQualifications = async (req, res, next) => {
  const { teacherId } = req.params;
  try {
    const qualifications = await TeacherQualification.findAll({
      where: { teacherId: teacherId },
    });
    res.status(200).json({ qualifications });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getQualification = async (req, res, next) => {
  const { qualificationId } = req.params;
  try {
    const qualification = await TeacherQualification.findOne({
      where: { id: qualificationId },
    });
    if (!qualification) {
      const error = new Error("Qualification not found");
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({ qualification });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updateQualification = async (req, res, next) => {
  try {
    const { degree, institution, year, teacherId } = req.body;
    const { qualificationId } = req.params;
    const qualification = await TeacherQualification.findOne({
      where: { id: qualificationId, teacherId: teacherId },
    });
    if (!qualification) {
      const error = new Error("Qualification not found");
      error.statusCode = 404;
      throw error;
    }
    qualification.degree = degree;
    qualification.institution = institution;
    qualification.year = year;
    await qualification.save();
    res
      .status(200)
      .json({ message: "Qualification updated successfully", qualification });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.deleteQualification = async (req, res, next) => {
  const { qualificationId } = req.params;
  try {
    const result = await TeacherQualification.destroy({
      where: { id: qualificationId },
    });
    if (result === 0) {
      const error = new Error("Qualification not found");
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({ message: "Qualification deleted successfully" });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

//Specialization
exports.addSpecialization = async (req, res, next) => {
  try {
    const { name, description, teacherId } = req.body;
    const specialization = await Specialization.create({
      name,
      description,
      teacherId: teacherId,
    });
    res
      .status(201)
      .json({ message: "Specialization created successfully", specialization });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getSpecializations = async (req, res, next) => {
  const { teacherId } = req.params;
  try {
    const specialization = await Specialization.findAll({
      where: { teacherId: teacherId },
    });
    res.status(200).json({ specialization });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
exports.updateSpecialization = async (req, res, next) => {
  try {
    const { name, description, teacherId } = req.body;
    const { specializationId } = req.params;
    const specialization = await Specialization.findOne({
      where: { id: specializationId, teacherId: teacherId },
    });
    if (!specialization) {
      const error = new Error("Specialization not found");
      error.statusCode = 404;
      throw error;
    }
    specialization.name = name;
    specialization.description = description;
    await specialization.save();
    res
      .status(200)
      .json({ message: "Specialization updated successfully", specialization });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.removeSpecialization = async (req, res, next) => {
  const { specializationId } = req.params;
  try {
    const result = await Specialization.destroy({
      where: { id: specializationId },
    });
    if (result === 0) {
      const error = new Error("Specialization not found");
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({ message: "Specialization deleted successfully" });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

//Feedback and upcoming classes
exports.addFeedback = async (req, res, next) => {
  try {
    const { studentId, feedback, rating, teacherId } = req.body;
    const newFeedback = await StudentFeedback.create({
      studentId,
      teacherId: teacherId,
      feedback,
      rating,
    });
    res
      .status(201)
      .json({ message: "Feedback added successfully", feedback: newFeedback });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.getFeedback = async (req, res, next) => {
  const { teacherId } = req.params;
  try {
    const feedbacks = await StudentFeedback.findAll({
      where: { teacherId: teacherId },
      include: [{ model: Student, attributes: ["id", "firstName", "lastName","profileImg"] }],
      order: [["createdAt", "DESC"]],
    });
    res.status(200).json({ feedbacks });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.respondToFeedback = async (req, res, next) => {
  const { feedbackId } = req.params;
  const { teacherId } = req.body;
  try {
    const feedback = await StudentFeedback.findOne({
      where: { id: feedbackId, teacherId: teacherId },
    });
    if (!feedback) {
      const error = new Error("Feedback not found");
      error.statusCode = 404;
      throw error;
    }
    feedback.responded = true;
    await feedback.save();
    res.status(200).json({ message: "Feedback marked as responded" });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.getClassMetrics = async (req, res, next) => {
  const { teacherId } = req.params;
  try {
    const totalClasses = await UpcomingClass.count({
      where: { teacherId: teacherId },
    });
    const averageRating = await StudentFeedback.findOne({
      where: { teacherId: teacherId },
      attributes: [
        [Sequelize.fn("AVG", Sequelize.col("rating")), "averageRating"],
      ],
    });
    res.status(200).json({
      totalClasses,
      averageRating: averageRating
        ? parseFloat(averageRating.getDataValue("averageRating")).toFixed(1)
        : 0,
    });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};
exports.addUpcomingClass = async (req, res, next) => {
  try {
    const { studentId, date, time, teacherId, courseDetailsId, meetingLink } = req.body;

    // Check if an upcoming class with the same studentId, teacherId, and courseDetailsId exists
    const existingClass = await UpcomingClass.findOne({
      where: {
        studentId,
        teacherId,
        courseDetailsId
      }
    });

    const student = await Student.findByPk(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    
    let newClass;

    if (existingClass) {
      // Update existing class
      await existingClass.update({
        time: time || existingClass.time, // update time only if provided
        meetingLink: meetingLink || existingClass.meetingLink // update meetingLink only if provided
      });
      newClass = existingClass;
    } else {
      // Create a new class entry
      newClass = await UpcomingClass.create({
        studentId,
        teacherId,
        courseDetailsId,
        meetingLink,
        date: date || new Date(),
        time,
      });
    }
    const formattedDate = new Date(date).toLocaleDateString(); // Format the date
    const formattedTime = new Date(`1970-01-01T${time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // Format the time

    // Determine the student's name to display
    const studentName = student.nameForTeacher || `${student.firstName} ${student.lastName}`;

    await sendNotifications(
      teacherId,
      studentId,
      studentName,
      formattedDate,
      formattedTime,
      `Class for ${studentName} scheduled on ${formattedDate} at ${formattedTime}.`,
      `Your class has been scheduled on ${formattedDate} at ${formattedTime}.`
    );

    res.status(201).json({
      message: existingClass ? "Upcoming class updated successfully" : "Upcoming class added successfully",
      class: newClass
    });
    
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};
exports.getMeetingLink = async (req, res, next) => {
  try {
    const { studentId, teacherId, courseDetailsId } = req.body;

    // Check if a class exists with the provided studentId, teacherId, and courseDetailsId
    const existingClass = await UpcomingClass.findOne({
      where: {
        studentId,
        teacherId,
        courseDetailsId
      },
      attributes: ['meetingLink','time'] // Only return the meetingLink field
    });

    if (!existingClass) {
      return res.status(404).json({ message: "No upcoming class found for the provided details." });
    }

    res.status(200).json({
      message: "Meeting link retrieved successfully",
      meetingData: existingClass
    });

  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

exports.getUpcomingClasses = async (req, res, next) => {
  const { teacherId } = req.params;
  try {
    const upcomingClasses = await UpcomingClass.findAll({
      where: {
        teacherId: teacherId
      },
      include: [{ model: Student, attributes: ["id", "firstName", "lastName","profileImg"] },
      {model:CourseDetails,
        include:{model:Courses}
      }],
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

exports.getAllUpcomingClasses = async (req, res, next) => {
  try {
    const upcomingClasses = await UpcomingClass.findAll({
      include: [{ model: Student, attributes: ["id", "firstName", "lastName","profileImg"] },
      {model:CourseDetails,
        include:{model:Courses}
      }],
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
exports.getCountTeacherProfileData = async (req, res, next) => {
  const { teacherId } = req.params;
  try {
    const students = await TeacherStudent.count({
      where: { TeacherId: teacherId },
      attributes: [],
    }).then((teacherStudents) => {
      if (teacherStudents.length === 0) {
        const error = new Error("No students found for this teacher.");
        error.statusCode = 404;
        throw error;
      }

      return teacherStudents;
    });

    const totalQualifications = await TeacherQualification.count({
      where: { teacherId: teacherId },
    });
    const totalSpecializations = await Specialization.count({
      where: { teacherId: teacherId },
    });
    const totalFeedback = await StudentFeedback.count({
      include: [{ model: Teacher, where: { id: teacherId } }],
    });

    res
      .status(200)
      .json({
        students,
        totalQualifications,
        totalSpecializations,
        totalFeedback,
      });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};
exports.cancelUpcomingClass = async (req, res, next) => {
  const { meetingId } = req.params;
  try {
    const result = await UpcomingClass.destroy({
      where: { id: meetingId },
    });
    if (result === 0) {
      const error = new Error("Meeting not found");
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({ message: "Meeting deleted successfully" });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.countAllTeachers = (req, res, next) => {
  Teacher.count()
    .then((totalTeachers) => {
      res.status(200).json({ totalTeachers });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};