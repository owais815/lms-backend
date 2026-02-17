const Notification = require("../models/Notifications"); // Adjust the path as needed
const { getIO } = require("../socket");
const { onlineUsers } = require("../SocketMethods/HandleConnection");

/**
 * Send notifications to a teacher and/or a student.
 * @param {string} teacherId - The ID of the teacher.
 * @param {string} studentId - The ID of the student.
 * @param {string} studentName - The name of the student.
 * @param {string} formattedDate - The formatted date of the event.
 * @param {string} formattedTime - The formatted time of the event.
 * @param {string} teacherMessage - The message for the teacher.
 * @param {string} studentMessage - The message for the student.
 * @param {boolean} notifyTeacher - Whether to notify the teacher (default: true).
 * @param {boolean} notifyStudent - Whether to notify the student (default: true).
 */

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
const sendNotifications = async (
  teacherId,
  studentId,
  studentName,
  formattedDate,
  formattedTime,
  teacherMessage,
  studentMessage,
  notifyTeacher = true,
  notifyStudent = true,
  title="Notification"
) => {
  try {
    const io = await waitForIO();

    // Notify the teacher if required
    if (notifyTeacher) {
      const teacherNotification = await Notification.create({
        userId: teacherId,
        userType: "teacher",
        title: title,
        message: teacherMessage || `Make up class for ${studentName} scheduled on ${formattedDate} at ${formattedTime}.`,
      });

      const teacherKey = `teacher-${teacherId}`;
      if (onlineUsers.has(teacherKey)) {
        const teacherSocketId = onlineUsers.get(teacherKey).socketId;
        io.to(teacherSocketId).emit("newNotification", teacherNotification);
      } else {
        console.log("Teacher is not online:", teacherKey);
      }
    }

    // Notify the student if required
    if (notifyStudent) {
      const studentNotification = await Notification.create({
        userId: studentId,
        userType: "student",
        title: title,
        message: studentMessage || `Your make up class has been scheduled on ${formattedDate} at ${formattedTime}.`,
      });

      const studentKey = `student-${studentId}`;
      if (onlineUsers.has(studentKey)) {
        const studentSocketId = onlineUsers.get(studentKey).socketId;
        io.to(studentSocketId).emit("newNotification", studentNotification);
      } else {
        console.log("Student is not online:", studentKey);
      }
    }
  } catch (error) {
    console.error("Error sending notifications:", error);
    throw error; // Re-throw the error to handle it in the controller
  }
};

module.exports = { sendNotifications };