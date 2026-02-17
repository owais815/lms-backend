const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const { Quiz, QuizAttempt, CourseDetails, Assignment, SubmittedAssignment, Courses } = require("../models/association");
const fs = require('fs').promises;
const path = require('path');

exports.createAssignment = async (req, res, next) => {
  try {
    const { title, description, dueDate, courseDetailsId, teacherId, maxScore, studentId } = req.body;
    // const fileUrl = req.file ? req.file.path : null;
    const { file } = req;
    // const originalFilename = file.originalname;
    const fileUrl = `/resources/${file.filename}`;

    const assignment = await Assignment.create({
      title,
      description,
      dueDate,
      fileUrl,
      courseDetailsId,
      teacherId,
      maxScore
    });

    // Create a SubmittedAssignment entry for the specific student
    await SubmittedAssignment.create({
      assignmentId: assignment.id,
      studentId,
      teacherId,
      status: 'Not Started'
    });

    res.status(201).json({ message: 'Assignment created and assigned successfully', assignment });
  } catch (error) {
    next(error);
  }
};

exports.submitAssignment = async (req, res, next) => {
  try {
    const { submittedAssignmentId } = req.body;
    const { file } = req;
    // const originalFilename = file.originalname;
    const fileUrl = `/resources/${file.filename}`;

    const submittedAssignment = await SubmittedAssignment.findByPk(submittedAssignmentId);
    if (!submittedAssignment) {
      return res.status(404).json({ message: 'Submitted assignment not found' });
    }

    submittedAssignment.fileUrl = fileUrl;
    submittedAssignment.submissionDate = new Date();
    submittedAssignment.status = 'Submitted';
    await submittedAssignment.save();

    res.status(200).json({ message: 'Assignment submitted successfully', submittedAssignment });
  } catch (error) {
    next(error);
  }
};

exports.gradeAssignment = async (req, res, next) => {
  try {
    const { submittedAssignmentId, score, feedback } = req.body;

    const submittedAssignment = await SubmittedAssignment.findByPk(submittedAssignmentId);
    if (!submittedAssignment) {
      return res.status(404).json({ message: 'Submitted assignment not found' });
    }

    submittedAssignment.score = score;
    submittedAssignment.feedback = feedback;
    submittedAssignment.status = 'Graded';
    await submittedAssignment.save();

    res.status(200).json({ message: 'Assignment graded successfully', submittedAssignment });
  } catch (error) {
    next(error);
  }
};

exports.getStudentAssignments = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const submittedAssignments = await SubmittedAssignment.findAll({
      where: { studentId },
      include: [
        {
          model: Assignment,
          include: [
            {
              model: CourseDetails,
              as: 'CourseDetails',

              include: [
                {
                  model: Courses,
                },
              ],
            },
            {
              model: Teacher,
              attributes: ['id', 'firstName', 'lastName','imageUrl']
            }
          ]
        }
      ]
    });

    res.status(200).json({ assignments: submittedAssignments });
  } catch (error) {
    next(error);
  }
};

exports.getTeacherAssignments = async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const submittedAssignments = await SubmittedAssignment.findAll({
      where: { teacherId },
      include: [
        {
          model: Assignment,
          include: [
            {
              model: CourseDetails,
              as: 'CourseDetails',

              include: [
                {
                  model: Courses,
                },
              ],
            }
          ]
        },
        {
          model: Student,
          attributes: ["id", "firstName", "lastName","profileImg"]
        }
      ]
    });

    res.status(200).json({ assignments: submittedAssignments });
  } catch (error) {
    next(error);
  }
};

exports.getAllAssignmentsTeacher = async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const assignment = await Assignment.findAll({
      where: { teacherId },
      include: [
        
            {
              model: CourseDetails,
              as: 'CourseDetails',
              include: [
                {
                  model: Courses,
                },
              ],
            },
      ]
    });

    res.status(200).json({ assignments: assignment });
  } catch (error) {
    next(error);
  }
};
exports.deleteAssignmentFile = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;

    const assignment = await Assignment.findByPk(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    // console.log("assignment is:::",assignment);
    // Delete the file from the server
    const filePath = path.join(__dirname, '..', assignment.fileUrl);
    fs.unlink(filePath);

    await assignment.destroy();
    res.status(200).json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting assignment', error: error.message });
    next(error);
  }
};

exports.deleteSubmittedAssignmentFile = async (req, res, next) => {
  try {
    const { submittedAssignmentId } = req.params;

    const assignment = await SubmittedAssignment.findByPk(submittedAssignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Submitted Assignment not found' });
    }

    // Delete the file from the server
    const filePath = path.join(__dirname, '..', assignment.fileUrl);
    fs.unlink(filePath);

    await assignment.destroy();
    res.status(200).json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting assignment', error: error.message });
    next(error);
  }
};

