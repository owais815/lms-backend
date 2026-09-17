const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const { Quiz, QuizAttempt, CourseDetails, Assignment, SubmittedAssignment, Courses } = require("../models/association");
const Admin = require("../models/Admin");
const notify = require("../utils/notify");
const { sendEmailEvent } = require("../emails");
const {
  notifyStudentsAndParents,
  notifyStudentAndParent,
  displayName,
} = require("../utils/notifyAudience");
const fs = require('fs').promises;
const path = require('path');

exports.createAssignment = async (req, res, next) => {
  try {
    const { title, description, dueDate, courseId, teacherId, maxScore } = req.body;
    const fileUrl = req.file ? `/resources/${req.file.filename}` : null;

    // Find all students enrolled in this course under this teacher
    const courseDetailsList = await CourseDetails.findAll({
      where: { courseId, teacherId },
    });
    if (!courseDetailsList.length) {
      return res.status(400).json({ message: 'No students are enrolled in this course yet.' });
    }

    // Check if teacher can publish directly or needs admin approval
    const teacher = await Teacher.findByPk(teacherId);
    const status = (!teacher || teacher.canDirectlyPublish === false) ? 'pending' : 'active';

    // Create the Assignment linked to the first CourseDetails record
    const assignment = await Assignment.create({
      title,
      description: description || null,
      dueDate: dueDate || null,
      fileUrl,
      maxScore: maxScore || null,
      courseDetailsId: courseDetailsList[0].id,
      teacherId,
      status,
    });

    // Only create SubmittedAssignment records if active (students can see it)
    if (status === 'active') {
      await Promise.all(
        courseDetailsList.map((cd) =>
          SubmittedAssignment.create({
            assignmentId: assignment.id,
            studentId: cd.studentId,
            teacherId,
            status: 'Not Started',
          })
        )
      );
      // Notify each student of new assignment
      const teacherName = displayName(teacher, 'Your teacher');
      await notifyStudentsAndParents({
        studentIds: courseDetailsList.map((cd) => cd.studentId),
        title: 'New Assignment',
        message: `${teacherName} published a new assignment: "${title}".`,
        parentMessage: `${teacherName} published a new assignment for your child: "${title}".`,
        emailEvent: 'assignment.published',
        emailContext: { assignment, teacher, courseId: assignment.courseId },
      });
    } else {
      // Notify all admins of pending assignment awaiting approval
      const admins = await Admin.findAll({ attributes: ['id'] });
      const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : 'A teacher';
      await Promise.all(
        admins.map((admin) =>
          notify({
            userId: admin.id,
            userType: 'admin',
            title: 'Assignment Pending Approval',
            message: `${teacherName} submitted an assignment "${title}" awaiting your approval.`,
          })
        )
      );
      sendEmailEvent('approval.assignment_pending', { assignment, teacher });
    }

    res.status(201).json({ message: 'Assignment created and assigned to all students', assignment });
  } catch (error) {
    next(error);
  }
};

exports.updateAssignment = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const { title, description, dueDate, maxScore } = req.body;

    const assignment = await Assignment.findByPk(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (dueDate !== undefined) {
      updates.dueDate = dueDate;
      // A moved deadline is a new deadline — let the due-soon reminder fire again.
      if (String(dueDate) !== String(assignment.dueDate)) updates.dueReminderSentAt = null;
    }
    if (maxScore !== undefined) updates.maxScore = maxScore;
    if (req.file) updates.fileUrl = `/resources/${req.file.filename}`;
    // If rejected, resubmitting goes back to pending
    if (assignment.status === 'rejected') updates.status = 'pending';

    await assignment.update(updates);
    res.status(200).json({ message: 'Assignment updated successfully', assignment });
  } catch (error) {
    next(error);
  }
};

exports.approveAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const assignment = await Assignment.findByPk(id, {
      include: [{ model: CourseDetails, as: 'CourseDetails' }],
    });
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    await assignment.update({ status: 'active' });

    // Create SubmittedAssignment records for all enrolled students not yet created
    const courseId = assignment.CourseDetails && assignment.CourseDetails.courseId;
    if (courseId) {
      const courseDetailsList = await CourseDetails.findAll({
        where: { courseId, teacherId: assignment.teacherId },
      });
      const existingSubmissions = await SubmittedAssignment.findAll({
        where: { assignmentId: id },
        attributes: ['studentId'],
      });
      const existingStudentIds = existingSubmissions.map(s => s.studentId);
      const newRecords = courseDetailsList.filter(cd => !existingStudentIds.includes(cd.studentId));
      await Promise.all(
        newRecords.map(cd =>
          SubmittedAssignment.create({
            assignmentId: id,
            studentId: cd.studentId,
            teacherId: assignment.teacherId,
            status: 'Not Started',
          })
        )
      );
      // Notify teacher of approval
      notify({
        userId: assignment.teacherId,
        userType: 'teacher',
        title: 'Assignment Approved',
        message: `Your assignment "${assignment.title}" has been approved and is now visible to students.`,
      });
      sendEmailEvent('approval.assignment_decided', {
        assignment, approved: true, teacherId: assignment.teacherId,
      });
      // Notify all students + parents
      await notifyStudentsAndParents({
        studentIds: courseDetailsList.map((cd) => cd.studentId),
        title: 'New Assignment',
        message: `A new assignment "${assignment.title}" has been published for your course.`,
        parentMessage: `A new assignment "${assignment.title}" has been published for your child's course.`,
        emailEvent: 'assignment.published',
        emailContext: { assignment, courseId: assignment.courseId },
      });
    }

    res.status(200).json({ message: 'Assignment approved', assignment });
  } catch (error) {
    next(error);
  }
};

exports.rejectAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const assignment = await Assignment.findByPk(id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    await assignment.update({ status: 'rejected' });
    notify({
      userId: assignment.teacherId,
      userType: 'teacher',
      title: 'Assignment Rejected',
      message: `Your assignment "${assignment.title}" was not approved. Please review and resubmit.`,
    });
    sendEmailEvent('approval.assignment_decided', {
      assignment, approved: false, teacherId: assignment.teacherId,
    });
    res.status(200).json({ message: 'Assignment rejected', assignment });
  } catch (error) {
    next(error);
  }
};

exports.getAllAssignmentsAdmin = async (req, res, next) => {
  try {
    const assignments = await Assignment.findAll({
      include: [
        {
          model: CourseDetails,
          as: 'CourseDetails',
          include: [{ model: Courses }],
        },
        {
          model: Teacher,
          attributes: ['id', 'firstName', 'lastName'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.status(200).json({ assignments });
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

    // Notify teacher that a student submitted
    notify({
      userId: submittedAssignment.teacherId,
      userType: 'teacher',
      title: 'Assignment Submitted',
      message: `A student submitted their assignment. Check the submissions panel.`,
    });
    sendEmailEvent('assignment.submitted', {
      assignment: { id: submittedAssignment.assignmentId },
      teacherId: submittedAssignment.teacherId,
      studentId: submittedAssignment.studentId,
      entityId: submittedAssignment.id,
    });

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

    // Notify student + parent of the grade
    await notifyStudentAndParent({
      studentId: submittedAssignment.studentId,
      title: 'Assignment Graded',
      message: `Your assignment has been graded. You scored ${score} point${score !== 1 ? 's' : ''}.`,
      parentMessage: `Your child's assignment has been graded — ${score} point${score !== 1 ? 's' : ''}.`,
      emailEvent: 'assignment.graded',
      emailContext: {
        assignment: { id: submittedAssignment.assignmentId, title: 'your assignment' },
        score,
        entityId: submittedAssignment.id,
      },
    });

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
          where: { status: 'active' },
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

