const { MakeUpClass, CourseDetails, Teacher, Student, Courses } = require("../models/association");
const Notification = require("../models/Notifications");
const { getIO } = require("../socket");
const { onlineUsers } = require("../SocketMethods/HandleConnection");
const { sendNotifications } = require("../utils/notificationUtil");


const waitForIO = async () => {
  let io;
  while (!io) {
    try {
      io = await getIO(); // Await the promise returned by getIO()
    } catch (err) {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait 100ms before retrying
    }
  }
  return io;
};

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

    // Create a notification for the teacher
        // Send notifications using the utility function
        await sendNotifications(
          teacherId,
          studentId,
          studentName,
          formattedDate,
          formattedTime,
          `Make up class for ${studentName} scheduled on ${formattedDate} at ${formattedTime}.`,
          `Your make up class has been scheduled on ${formattedDate} at ${formattedTime}.`
        );
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
