const Courses = require("../models/Course");
const CourseDetails = require("../models/CourseDetails");
const EnrolledStudents = require("../models/EnrolledStudents");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const UpcomingCourses = require("../models/UpcomingCourse");

// Create a new upcoming course schedule
// A course can have multiple schedules (different teachers / dates)
exports.createUpcomingCourse = async (req, res) => {
  try {
    const { teacherId, courseId, startingFrom, isStarted } = req.body;
    const startingFromValue =
      startingFrom && !isNaN(Date.parse(startingFrom)) ? startingFrom : null;

    const newCourse = await UpcomingCourses.create({
      teacherId: teacherId || null,
      courseId,
      startingFrom: startingFromValue,
      isStarted: isStarted ?? false,
    });

    // Sync: mark the course as "isComing" since at least one schedule now exists
    await Courses.update({ isComing: true }, { where: { id: courseId } });

    res.status(201).json(newCourse);
  } catch (error) {
    res.status(500).json({ error: "Failed to create upcoming course", details: error.message });
  }
};

// Get all upcoming courses
exports.getAllUpcomingCourses = async (req, res) => {
  try {
    const courses = await UpcomingCourses.findAll({
      include: [
        { model: Courses },
        { model: Teacher, attributes: ["id", "firstName", "lastName", "imageUrl"] },
        { model: Student, attributes: ["id", "firstName", "lastName", "profileImg"] },
      ],
    });
    res.status(200).json(courses);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve upcoming courses", details: error.message });
  }
};

// Get an upcoming course by ID
exports.getUpcomingCourseById = async (req, res) => {
  try {
    const course = await UpcomingCourses.findByPk(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Upcoming course not found" });
    }
    res.status(200).json(course);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve upcoming course", details: error.message });
  }
};

// Update an upcoming course by ID
exports.updateUpcomingCourse = async (req, res) => {
  try {
    const course = await UpcomingCourses.findByPk(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Upcoming course not found" });
    }

    const { teacherId, courseId, startingFrom, isStarted } = req.body;
    await course.update({
      teacherId: teacherId || null,
      courseId,
      startingFrom,
      isStarted,
    });

    res.status(200).json(course);
  } catch (error) {
    res.status(500).json({ error: "Failed to update upcoming course", details: error.message });
  }
};

// Delete an upcoming course schedule by ID
exports.deleteUpcomingCourse = async (req, res) => {
  try {
    const course = await UpcomingCourses.findByPk(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Upcoming course not found" });
    }

    const courseId = course.courseId;
    await course.destroy();

    // Sync: if no more schedules remain for this course, clear isComing flag
    const remaining = await UpcomingCourses.count({ where: { courseId } });
    if (remaining === 0) {
      await Courses.update({ isComing: false }, { where: { id: courseId } });
    }

    res.status(200).json({ message: "Upcoming course deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete upcoming course", details: error.message });
  }
};

// Student self-enrollment into an upcoming course
// Also creates a CourseDetails record so the student gets full academic access
// (quiz, assignments, attendance, etc.)
exports.enrollStudent = async (req, res) => {
  const { courseId, studentId } = req.body;
  try {
    // Verify a schedule exists for this course
    const upcomingCourse = await UpcomingCourses.findOne({ where: { courseId } });
    if (!upcomingCourse) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Prevent duplicate self-enrollment
    const alreadyEnrolled = await EnrolledStudents.findOne({ where: { studentId, courseId } });
    if (alreadyEnrolled) {
      return res.status(400).json({ message: "Student already enrolled in this course" });
    }

    // Create the self-enrollment record
    await EnrolledStudents.create({ studentId, courseId });

    // Auto-create CourseDetails so the student gets full academic access
    // (inherits the teacher assigned to this schedule)
    const existingDetail = await CourseDetails.findOne({ where: { studentId, courseId } });
    if (!existingDetail) {
      await CourseDetails.create({
        courseId,
        studentId,
        teacherId: upcomingCourse.teacherId || null,
      });
    }

    res.status(200).json({ message: "Student enrolled successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to enroll student", details: error.message });
  }
};

// Get all self-enrolled courses for a student
exports.getEnrolledCoursesOfStd = async (req, res) => {
  const { studentId } = req.params;
  try {
    const students = await EnrolledStudents.findAll({ where: { studentId } });
    res.status(200).json(students);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve enrolled students", details: error.message });
  }
};

// Get all students self-enrolled in a specific course
exports.getEnrolledCoursesOfCourses = async (req, res) => {
  const { courseId } = req.params;
  try {
    const students = await EnrolledStudents.findAll({
      where: { courseId },
      include: [{ model: Student }],
    });
    res.status(200).json(students);
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve enrolled students", details: error.message });
  }
};
