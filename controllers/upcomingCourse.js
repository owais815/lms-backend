const Courses = require("../models/Course");
const EnrolledStudents = require("../models/EnrolledStudents");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const UpcomingCourses = require("../models/UpcomingCourse");

exports.createUpcomingCourse = async (req, res) => {
  try {
    
    const { teacherId, studentId, courseId, startingFrom, isStarted } = req.body;
    console.log("teacherId, studentId, courseId, startingFrom, isStarted",  courseId);
    const startingFromValue = startingFrom && !isNaN(Date.parse(startingFrom)) ? startingFrom : null;
    const isExisted = await UpcomingCourses.findOne({
      where: {
        courseId,
      }
    });

    if (isExisted) {
      return res.status(400).json({ message: 'Upcoming course already exists' });
    }
    const newCourse = await UpcomingCourses.create({
      teacherId,
      studentId,
      courseId,
      startingFrom:startingFromValue,
      isStarted,
    });
    res.status(201).json(newCourse);
  } catch (error) {
    console.log("error is alisher", error);
    res.status(500).json({ error: 'Failed to create upcoming course', details: error.message });
  }
};

// Get all upcoming courses
exports.getAllUpcomingCourses = async (req, res) => {
  try {
    const courses = await UpcomingCourses.findAll({
      include: [
        { model: Courses },
        { model: Teacher, attributes: ['id', 'firstName', 'lastName','imageUrl'] },
        { model: Student, attributes: ["id", "firstName", "lastName","profileImg"] },
      ],
    });
    res.status(200).json(courses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve upcoming courses', details: error.message });
  }
};

// Get an upcoming course by ID
exports.getUpcomingCourseById = async (req, res) => {
  try {
    const course = await UpcomingCourses.findByPk(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Upcoming course not found' });
    }
    res.status(200).json(course);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve upcoming course', details: error.message });
  }
};

// Update an upcoming course by ID
exports.updateUpcomingCourse = async (req, res) => {
  try {
    const course = await UpcomingCourses.findByPk(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Upcoming course not found' });
    }

    const { teacherId, studentId, courseId, startingFrom, isStarted } = req.body;
    await course.update({
      teacherId,
      studentId,
      courseId,
      startingFrom,
      isStarted,
    });

    res.status(200).json(course);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update upcoming course', details: error.message });
  }
};

// Delete an upcoming course by ID
exports.deleteUpcomingCourse = async (req, res) => {
  try {
    const course = await UpcomingCourses.findByPk(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Upcoming course not found' });
    }

    await course.destroy();
    res.status(200).json({ message: 'Upcoming course deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete upcoming course', details: error.message });
  }
};

exports.enrollStudent = async (req, res) => {
  const { courseId, studentId } = req.body;
  try {
    const course = await UpcomingCourses.findOne({
      where: { courseId },
    });
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    const EnrolledStudent = await EnrolledStudents.findOne({
      where: { studentId, courseId },
    });
    if (EnrolledStudent) {
      return res.status(400).json({ message: 'Student already enrolled in this course' });
    }
    await EnrolledStudents.create({
      studentId,
      courseId,
    })
    res.status(200).json({ message: 'Student enrolled successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to enroll student', details: error.message });
  }
}

exports.getEnrolledCoursesOfStd = async (req, res) => {
  const { studentId } = req.params;
  try {
    const students = await EnrolledStudents.findAll({
      where: { studentId },
    });
    res.status(200).json(students);
  } catch (error) {
    console.log("errrosss is::::::",error)
    res.status(500).json({ error: 'Failed to retrieve enrolled students', details: error.message });
  }
}
exports.getEnrolledCoursesOfCourses = async (req, res) => {
  const { courseId } = req.params;
  try {
    const students = await EnrolledStudents.findAll({
      where: { courseId },
      include:[
        {model:Student}]
    });
    res.status(200).json(students);
  } catch (error) {
    console.log("errrosss is::::::",error)
    res.status(500).json({ error: 'Failed to retrieve enrolled students', details: error.message });
  }
}