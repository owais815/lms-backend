const { MakeUpClass, CourseDetails, Teacher, Student, Courses } = require("../models/association");
const notify = require("../utils/notify");
const { sendEmailEvent } = require("../emails");
const notifyAdmins = require("../utils/notifyAdmins");
const { notifyStudentAndParent } = require("../utils/notifyAudience");


exports.scheduleClass = async (req, res) => {
  const { reason, status, teacherId, studentId, courseDetailsId, date, time } = req.body;

  try {
    // Fetch the student's details
    const student = await Student.findByPk(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Fetch the teacher's details (optional, if needed)
    const teacher = await Teacher.findByPk(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Create the makeup class
    const newClass = await MakeUpClass.create({
      reason,
      status,
      teacherId,
      studentId,
      courseDetailsId,
      date,
      time,
    });

    // Format the date and time for the notification message
    const formattedDate = new Date(date).toLocaleDateString(); // Format the date
    const formattedTime = new Date(`1970-01-01T${time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // Format the time

    // Determine the student's name to display
    const studentName = student.nameForTeacher || `${student.firstName} ${student.lastName}`;

    await notify({
      userId: teacherId,
      userType: 'teacher',
      title: 'Makeup Class Scheduled',
      message: `Make up class for ${studentName} scheduled on ${formattedDate} at ${formattedTime}.`,
    });
    await notify({
      userId: studentId,
      userType: 'student',
      title: 'Makeup Class Scheduled',
      message: `Your make up class has been scheduled on ${formattedDate} at ${formattedTime}.`,
    });


    notifyAdmins({
      title: 'Makeup Class Requested',
      message: `A makeup class for ${studentName} on ${formattedDate} at ${formattedTime} is awaiting approval.`,
    });
    sendEmailEvent('makeup.requested', {
      makeup: { id: newClass.id, date: formattedDate, time: formattedTime },
      studentId, teacherId,
    });

    res.status(201).json({ message: 'Makeup class scheduled successfully', data: newClass });
  } catch (error) {
    console.error('Error scheduling makeup class:', error);
    res.status(500).json({ message: 'Failed to schedule makeup class', error });
  }
};
exports.getStatus = async (req, res) => {
  const { studentId } = req.params;

  try {
    const classes = await MakeUpClass.findAll({
      where: { studentId },
      include:[
        {model:CourseDetails, include:[{model:Courses,attributes:['id','courseName']}]},
        {model:Teacher,attributes:['id','firstName','lastName']}
      ]
    });

    if (classes.length === 0) {
      return res.status(404).json({ message: 'No makeup classes found for this student' });
    }

    res.status(200).json(classes);
  } catch (error) {
    console.error('Error fetching class status:', error);
    res.status(500).json({ message: 'Failed to fetch class status', error });
  }
};

exports.getAllStatus = async (req, res) => {
  try {
    const allClasses = await MakeUpClass.findAll({
      include:[
        {model:CourseDetails, include:[{model:Courses,attributes:['id','courseName']}]},
        {model:Teacher,attributes:['id','firstName','lastName']},
        {model:Student,attributes:['id','firstName','lastName']}
      ]
    });

    res.status(200).json(allClasses);
  } catch (error) {
    console.error('Error fetching all class statuses:', error);
    res.status(500).json({ message: 'Failed to fetch all class statuses', error });
  }
};

exports.updateStatus = async (req, res) => {
  const { classId } = req.params;
  const { status,adminReason } = req.body;
  console.log("classsss id is::::",classId,status,adminReason);
  try {
    const makeupClass = await MakeUpClass.findOne({
      where: { id:classId },
    });

    if (!makeupClass) {
      return res.status(404).json({ message: 'Makeup class not found' });
    }

    makeupClass.status = status;
    makeupClass.adminReason = adminReason;
    await makeupClass.save();

    const formattedDate = new Date(makeupClass.date).toLocaleDateString();
    const formattedTime = new Date(`1970-01-01T${makeupClass.time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (status === 'Approved') {
      notify({
        userId: makeupClass.teacherId,
        userType: 'teacher',
        title: 'Makeup Class Approved',
        message: `The makeup class on ${formattedDate} at ${formattedTime} has been approved.`,
      });
      await notifyStudentAndParent({
        studentId: makeupClass.studentId,
        title: 'Makeup Class Confirmed',
        message: `Your makeup class is confirmed for ${formattedDate} at ${formattedTime}.`,
        parentMessage: `Your child's makeup class is confirmed for ${formattedDate} at ${formattedTime}.`,
        emailEvent: 'makeup.approved',
        emailContext: {
          makeup: { id: makeupClass.id, date: formattedDate, time: formattedTime },
          teacherId: makeupClass.teacherId,
        },
      });
    } else if (status === 'Rejected') {
      notify({
        userId: makeupClass.teacherId,
        userType: 'teacher',
        title: 'Makeup Class Rejected',
        message: `Your makeup request for ${formattedDate} at ${formattedTime} was rejected${adminReason ? `: ${adminReason}` : '.'}`,
        priority: 'warning',
      });
      sendEmailEvent('makeup.rejected', {
        makeup: { id: makeupClass.id, date: formattedDate, time: formattedTime, adminReason },
        teacherId: makeupClass.teacherId,
      });
    }

    res.status(200).json({ message: 'Class status updated successfully', data: makeupClass });
  } catch (error) {
    console.error('Error updating class status:', error);
    res.status(500).json({ message: 'Failed to update class status', error });
  }
};

exports.deleteClass = async (req, res) => {
  const { classId } = req.params;
  try {
    const makeupClass = await MakeUpClass.findByPk(classId);
    if (!makeupClass) {
      return res.status(404).json({ message: 'Makeup Class not found' });
    }
    await makeupClass.destroy();
    return res.status(200).json({ message: 'Makeup Class deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete Class' });
  }
};
