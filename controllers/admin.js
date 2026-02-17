const { validationResult } = require("express-validator");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require("../models/Admin");
const Role = require("../models/Roles");
const AdminRights = require("../models/AdminRights");
const Teacher = require("../models/Teacher");
const TeacherStudent = require("../models/TeacherStudent");
const CourseDetails = require("../models/CourseDetails");
const Student = require("../models/Student");
const Courses = require("../models/Course");
const fs = require('fs').promises;
const path = require('path');
const Announcements = require("../models/Announcements");
const { Op, Sequelize } = require('sequelize');
const Parent = require("../models/Parent");
const UpcomingClass = require("../models/UpcomingClasses");
const Rights = require("../models/Admin");
const RolesRights = require("../models/RolesRights");

exports.signup= (req,res,next)=>{
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        const error = new Error('Validation failed.');
        error.statusCode = 422;
        error.data = errors.array();
        throw error;
    }
    const username = req.body.username;
    const name = req.body.name;
    const password = req.body.password;

    bcrypt.hash(password,12)
    .then(hashPwd=>{
        const user = new Teacher({
            username:username,
            name:name,
            password:hashPwd
        });
        return user.save();
    })
    .then(result=>{
        res.status(200).json({message:'Sub-Admin saved successfully.!',userId:result.id});
    })
    
    .catch(err=>{
        if(!err?.statusCode){
            err.statusCode = 500;
        }
        next(err);
    });
}
exports.login = async (req, res, next) => {
    const { username, password } = req.body;
    
    try {
        // Check if there are any admin records
        const adminCount = await Admin.count();
        
        if (adminCount === 0) {
            // If no admin exists, create one with the provided credentials
            const hashedPassword = await bcrypt.hash(password, 12);
            const newAdmin = await Admin.create({
                username: username,
                password: hashedPassword,
                name:"Admin",
            });
            return res.status(201).json({
                message: 'Initial admin account created and logged in',
                userId: newAdmin.id,
                role: 'null'
            });
        }
        
        // If admins exist, proceed with normal login flow
        const user = await Admin.findOne({ where: { username: username } });
        
        if (!user) {
            const error = new Error('Admin with this username not found.');
            error.statusCode = 401;
            throw error;
        }
        
        const isEqual = await bcrypt.compare(password, user.password);
        
        if (!isEqual) {
            const error = new Error('Password doesn\'t match.');
            error.statusCode = 401;
            throw error;
        }
        
        res.status(200).json({ message:"loggedin successfull.", userId: user.id,role:user.roleId });
    } catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};
exports.update = (req, res, next) => {
    const adminId = req.params.adminId; 
    const updateFields = {};
    
    // Extract fields that can be updated from the request body
    const { name, password } = req.body;

    // Add the update fields to the updateFields object if they are provided
    if (name) {
        updateFields.name = name;
    }
    if (password) {
        // Hash the new password before updating
        bcrypt.hash(password, 12)
            .then(hashPwd => {
                updateFields.password = hashPwd;
            });
    }
    // Find the Teacher record by ID and update the fields
    Admin.findByPk(adminId)
        .then(admin => {
            if (!admin) {
                const error = new Error('Admin not found.');
                error.statusCode = 404;
                throw error;
            }
            
            // Update the Teacher record with the new field values
            return admin.update(updateFields);
        })
        .then(updatedAdmin => {
            // Return success response with the updated Teacher details
            res.status(200).json({ message: 'Admin updated successfully.', admin: updatedAdmin });
        })
        .catch(err => {
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        });
};
//delete admin record on Id
exports.delete = (req, res, next) => {
    const adminId = req.params.adminId; // Get adminId from URL params

    // Find the Teacher record by ID and delete it
    Admin.findByPk(adminId)
        .then(admin => {
            if (!admin) {
                const error = new Error('Admin not found.');
                error.statusCode = 404;
                throw error;
            }

            // Delete the adminId record
            return admin.destroy();
        })
        .then(() => {
            // Send success response
            res.status(200).json({ message: 'Admin deleted successfully.' });
        })
        .catch(err => {
            // Handle errors
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        });
};
// getAllAdmins
exports.getAllAdmins = (req, res, next) => {
    // Query the database to retrieve all admin records
    Admin.findAll()
        .then(admin => {
            // Send success response with the retrieved admin records
            res.status(200).json({ admin: admin });
        })
        .catch(err => {
            // Handle errors
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        });
};
// get admin by Id
exports.getAdminById = (req, res, next) => {
    const adminId = req.params.adminId;
    console.log("admin id is:::",adminId);
    // Query the database to retrieve all Admin records
    Admin.findByPk({where:{id:adminId}})
        .then(admin => {
            if (!admin) {
                const error = new Error('admin not foundadfsa.');
                error.statusCode = 404;
                throw error;
            }
            // Send success response with the retrieved Admin records
            res.status(200).json({ admin: admin });
        })
        .catch(err => {
            // Handle errors
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        });
};
// get admin by Username
exports.getAdminByUsername = (req, res, next) => {
    const {username} = req.body;
    // Query the database to retrieve all teacher records
    Admin.findByPk({where:{username:username}})
        .then(admin => {
            if (!admin) {
                const error = new Error('Admin not found.');
                error.statusCode = 404;
                throw error;
            }
            // Send success response with the retrieved admin records
            res.status(200).json({ admin: admin });
        })
        .catch(err => {
            // Handle errors
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        });
};
exports.assignTeacher = (req, res, next) => {
    const { teacherId, studentId } = req.body;
    // console.log(teacherId, studentId);

    // Validate inputs
    if (!teacherId || !studentId) {
        const error = new Error('Both teacherId and studentId are required.');
        error.statusCode = 400;
        throw error;
    }

    // Check if the same teacherId and studentId combination already exists
    TeacherStudent.findByPk({
        where: {
            TeacherId: teacherId,
            StudentId: studentId
        }
    })
    .then(existingAssignment => {
        if (existingAssignment) {
            // If the combination already exists, send a 409 Conflict response
            const error = new Error('This assignment already exists.');
            error.statusCode = 409;
            throw error;
        }
        
        // Create a new entry in the TeacherStudent model
        return TeacherStudent.create({
            TeacherId: teacherId,
            StudentId: studentId
        });
    })
    .then(() => {
        // Send success response
        res.status(201).json({ message: 'Student assigned to teacher successfully.' });
    })
    .catch(err => {
        // Handle errors
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    });
};
exports.updateTeacherPasswordByUsername = async (req, res, next) => {
    try {
        const { password,username } = req.body;

        if (!password) {
            const error = new Error('Password is required.');
            error.statusCode = 400;
            throw error;
        }

        // Hash the password
        const hashPwd = await bcrypt.hash(password, 12);

        // Find the Teacher by username
        const teacher = await Teacher.findByPk({ where: { username: username } });

        if (!teacher) {
            const error = new Error('Teacher not found.');
            error.statusCode = 404;
            throw error;
        }

        // Update the teacher's password
        await teacher.update({ password: hashPwd });

        res.status(200).json({ message: 'Teacher password updated successfully.', teacher });
    } catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};
//update admin password
exports.updatePassword = async (req, res, next) => {
    try {
        const { password,username } = req.body;

        if (!password) {
            const error = new Error('Password is required.');
            error.statusCode = 400;
            throw error;
        }

        // Hash the password
        const hashPwd = await bcrypt.hash(password, 12);

        const admin = await Admin.findByPk({ where: { username: username } });

        if (!admin) {
            const error = new Error('Not found.');
            error.statusCode = 404;
            throw error;
        }

        // Update the admin's password
        await admin.update({ password: hashPwd });

        res.status(200).json({ message: 'Admin password updated successfully.', admin });
    } catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};
exports.updateStudentPasswordByUsername = async (req, res, next) => {
    try {
        const { password,username } = req.body;

        if (!password) {
            const error = new Error('Password is required.');
            error.statusCode = 400;
            throw error;
        }

        // Hash the password
        const hashPwd = await bcrypt.hash(password, 12);

        // Find the Student by username
        const student = await Student.findByPk({ where: { username: username } });

        if (!student) {
            const error = new Error('Student not found.');
            error.statusCode = 404;
            throw error;
        }

        // Update the student's password
        await student.update({ password: hashPwd });

        res.status(200).json({ message: 'Student password updated successfully.', student });
    } catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};
exports.updateParentPasswordByUsername = async (req, res, next) => {
    try {
        const { password,username } = req.body;

        if (!password) {
            const error = new Error('Password is required.');
            error.statusCode = 400;
            throw error;
        }

        // Hash the password
        const hashPwd = await bcrypt.hash(password, 12);

        // Find the Student by username
        const parent = await Parent.findByPk({ where: { username: username } });

        if (!parent) {
            const error = new Error('Parent not found.');
            error.statusCode = 404;
            throw error;
        }

        // Update the parent's password
        await parent.update({ password: hashPwd });

        res.status(200).json({ message: 'Parent password updated successfully.', parent });
    } catch (err) {
        if (!err.statusCode) {
            err.statusCode = 500;
        }
        next(err);
    }
};
//courses
exports.addCourse =async (req,res,next)=>{
    try{
        const errors = validationResult(req);
        if(!errors.isEmpty()){
            const error = new Error('Validation failed.');
            error.statusCode = 422;
            error.data = errors.array();
            throw error;
        }
        const {courseName, duration, description,isComing} = req.body;
        const { file } = req;
        
        const imageUrl = file && file?.path?.replace("\\", "/");

        const newCourse = await Courses.create({
            courseName,
            duration,
            description,
            isComing,
            imageUrl: file ? imageUrl : null
        });
        res.status(201).json({ message: 'Course added successfully.', newCourse });
    }catch(err){
        console.log("error is:::",err);
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}
exports.getAllCourses =async (req,res,next)=>{
    try{
        const courses = await Courses.findAll();
        if(!courses){   
            const message ='No courses found.';    
        res.status(200).json({ courses,message });
           
        }
        res.status(200).json({ courses });
    }catch(err){
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}
exports.getAllCoursesUpcoming =async (req,res,next)=>{
    try{
        const courses = await Courses.findAll({where:{isComing:true}});
        if(!courses){   
            const message ='No courses found.';    
        res.status(200).json({ courses,message });
           
        }
        res.status(200).json({ courses });
    }catch(err){
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}
exports.deleteCourse =async (req,res,next)=>{
    try{
        const courseId = req.params.courseId;
        const course = await Courses.findByPk(courseId);
        if(!course){
            const error = new Error('Course not found.');
            error.statusCode = 404;
            throw error;
        }
        const filePath = path.join(__dirname, '..', course.imageUrl);
        fs.unlink(filePath);

        await course.destroy();
        res.status(200).json({ message: 'Course deleted successfully.' });
    }catch(err){
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}
exports.updateCourse =async (req,res,next)=>{
    try{
        const courseId = req.params.courseId;
        const course = await Courses.findByPk(courseId);
        if(!course){   
            const error = new Error('Course not found.');
            error.statusCode = 404;
            throw error;
        }
        const { file } = req;
        let imageUrl=null;
        if(file){
            if(course?.imageUrl){
                const filePath = path.join(__dirname, '..', course.imageUrl);
                fs.unlink(filePath);
            }
         imageUrl = file && file?.path?.replace("\\", "/");
        }
        const {courseName, duration, description} = req.body;
        await course.update({
            courseName,
            duration,
            description,
            imageUrl
        });
        res.status(200).json({ message: 'Course updated successfully.', course });  
    }catch(err){
        console.log("error is:::",err);
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}
// POST: Admin creates a new announcement
exports.createAnnouncement = async (req, res) => {
    try {
        const { title, message, scheduledTime, userType, userIds,type,daysToLive } = req.body;
         // Calculate expiration date based on daysToLive
    // const expirationDate = new Date();
    // expirationDate.setDate(expirationDate.getDate() + daysToLive);


        // Validate scheduledTime against current time
        if (new Date(scheduledTime) < new Date()) {
            return res.status(400).json({ error: 'Scheduled time cannot be in the past.' });
        }

        // Validate userIds
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ error: 'userIds must be a non-empty array.' });
        }

        // Create announcements for each user in the array
        const announcements = await Promise.all(
            userIds.map(userId =>
                Announcements.create({
                    title,
                    message,
                    scheduledTime,
                    userType,
                    userId,
                    type,
                    expirationDate:daysToLive
                })
            )
        );

        res.status(201).json({ announcements });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Failed to create announcements.' });
    }
};
// GET: Students/Teachers view announcements
exports.getAnnouncements = async (req, res) => {
    try {
        const { userType,userId } = req.body;

        if (!userType || (userType !== 'student' && userType !== 'teacher')) {
            return res.status(400).json({ error: 'Invalid user type specified.' });
        }

        const currentTime = new Date();

        const announcements = await Announcements.findAll({
            where: {
                userType,
                userId,
                scheduledTime: { [Op.lte]: currentTime }
            },
            order: [['scheduledTime', 'DESC']]
        });

        res.status(200).json({ announcements });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve announcements.' });
    }
};

exports.getAllAnnouncements = async (req, res) => {
    try {
        const announcements = await Announcements.findAll();
        res.status(200).json({ announcements });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve announcements.' });
    }
};

exports.deleteAnnouncement = async (req, res,next) => {
    try {
        const announcementId = req.params.announcementId;
        console.log("id iss:::",announcementId);
        const announcement = await Announcements.findByPk(announcementId);
        if (!announcement) {
            const error = new Error('Announcement not found.');
            error.statusCode = 404;
            throw error;
        }
        await announcement.destroy();
        res.status(200).json({ message: 'Announcement deleted successfully.' });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
}

exports.getNextFourHoursClasses = async (req, res, next) => {
  try {
    const now = new Date();
    const fourHoursLater = new Date();
    fourHoursLater.setHours(now.getHours() + 4);

    const nowTime = now.toTimeString().split(" ")[0]; // Extracts "HH:mm:ss"
    const fourHoursLaterTime = fourHoursLater.toTimeString().split(" ")[0]; // Extracts "HH:mm:ss"

    let timeCondition;

    if (fourHoursLater.getDate() !== now.getDate()) {
      // Handles midnight overflow case
      timeCondition = {
        [Op.or]: [
          { time: { [Op.gte]: nowTime } }, // Remaining classes for today
          { time: { [Op.lte]: fourHoursLaterTime } }, // Classes after midnight
        ],
      };
    } else {
      // Normal case (same day)
      timeCondition = { time: { [Op.between]: [nowTime, fourHoursLaterTime] } };
    }

    const upcomingClasses = await UpcomingClass.findAll({
      where: timeCondition,
      include: [
        {
          model: Student,
          attributes: ["id", "firstName", "lastName", "profileImg"],
        },
      ],
      order: [[Sequelize.literal("STR_TO_DATE(time, '%H:%i:%s')"), "ASC"]],
      limit: 50,
    });

    res.status(200).json({ upcomingClasses });
  } catch (err) {
    if (!err.statusCode) err.statusCode = 500;
    next(err);
  }
};

const generateTimeSlots = (startTime, endTime) => {
    const slots = [];
    let currentTime = new Date(`1970-01-01T${startTime}`);
    const end = new Date(`1970-01-01T${endTime}`);
  
    // Handle midnight wrap-around for evening shift
    if (end < currentTime) {
      // Evening shift spans midnight
      while (currentTime <= new Date(`1970-01-01T23:59:59`)) {
        const slotStart = currentTime.toTimeString().slice(0, 8);
        currentTime.setMinutes(currentTime.getMinutes() + 30); // Add 30 minutes
        const slotEnd = currentTime.toTimeString().slice(0, 8);
        slots.push({ start: slotStart, end: slotEnd });
      }
  
      // Reset currentTime to 00:00:00 for the next day
      currentTime = new Date(`1970-01-01T00:00:00`);
      while (currentTime <= end) {
        const slotStart = currentTime.toTimeString().slice(0, 8);
        currentTime.setMinutes(currentTime.getMinutes() + 30); // Add 30 minutes
        const slotEnd = currentTime.toTimeString().slice(0, 8);
        slots.push({ start: slotStart, end: slotEnd });
      }
    } else {
      // Morning shift (no midnight wrap-around)
      while (currentTime < end) {
        const slotStart = currentTime.toTimeString().slice(0, 8);
        currentTime.setMinutes(currentTime.getMinutes() + 30); // Add 30 minutes
        const slotEnd = currentTime.toTimeString().slice(0, 8);
        slots.push({ start: slotStart, end: slotEnd });
      }
    }
  
    return slots;
  };
  
  exports.getFreeTimeSlots = async (req, res, next) => {
    try {
      const { teacherId, timeRange } = req.params;
  
      // Define start & end time based on shift
      let startTime, endTime;
      if (timeRange === "morning") {
        startTime = "05:00:00";
        endTime = "17:00:00";
      } else {
        startTime = "17:00:00";
        endTime = "05:00:00"; // Spans midnight
      }
  
      let whereCondition = {
        [Op.or]: [
          { time: { [Op.between]: [startTime, "23:59:59"] } },
          { time: { [Op.between]: ["00:00:00", endTime] } },
        ],
      };
  
      if (teacherId && teacherId !== "null") {
        whereCondition.teacherId = teacherId;
      }
  
      // Fetch all classes in the time range
      const upcomingClasses = await UpcomingClass.findAll({
        where: whereCondition,
        include: [{ model: Teacher, attributes: ["id", "firstName", "lastName", "imageUrl"] }],
        order: [["time", "ASC"]],
      });
  
      let freeSlots = {};
  
      // Organize classes by teacher
      upcomingClasses.forEach((cls) => {
        const teacherId = cls.teacherId;
        if (!freeSlots[teacherId]) freeSlots[teacherId] = [];
        freeSlots[teacherId].push(cls);
      });
  
      // Calculate free slots for each teacher
      Object.keys(freeSlots).forEach((tId) => {
        const teacherClasses = freeSlots[tId].sort((a, b) => a.time.localeCompare(b.time)); // Sort classes by time
        const allSlots = generateTimeSlots(startTime, endTime); // Generate all 30-minute slots in the shift
  
        // Filter out occupied slots
        const occupiedSlots = teacherClasses.map((cls) => {
          const classStart = cls.time;
          const classEnd = new Date(`1970-01-01T${cls.time}`);
          classEnd.setMinutes(classEnd.getMinutes() + 30); // Assuming 30 min classes
          return { start: classStart, end: classEnd.toTimeString().slice(0, 8) };
        });
  
        // Remove occupied slots from all slots
        const teacherFreeSlots = allSlots.filter((slot) => {
          return !occupiedSlots.some(
            (occupied) =>
              (slot.start >= occupied.start && slot.start < occupied.end) ||
              (slot.end > occupied.start && slot.end <= occupied.end)
          );
        });
  
        freeSlots[tId] = teacherFreeSlots;
      });
  
      // If no classes are found, mark the entire shift as free
      if (Object.keys(freeSlots).length === 0 && teacherId) {
        freeSlots[teacherId] = generateTimeSlots(startTime, endTime);
      }
  
      res.status(200).json({ freeSlots });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error", error: err });
    }
  };

  exports.getRoles = (req, res, next) => {
    // Query the database to retrieve all admin records
    Role.findAll()
        .then(role => {
            // Send success response with the retrieved admin records
            res.status(200).json({role });
        })
        .catch(err => {
            // Handle errors
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        });
};

exports.createRole = async (req, res) => {
  const {
    role
  } = req.body;

  try {
    const roles = await Role.create({
     role
    });
    res.status(201).json({
      success: true,
      message: "Role created successfully.",
      roles,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};


exports.updateRole =async (req,res,next)=>{
    try{
        const roleId = req.params.roleId;
        const rolee = await Role.findByPk(roleId);
        if(!rolee){   
            const error = new Error('Role not found.');
            error.statusCode = 404;
            throw error;
        }
       
        const {role} = req.body;
        await rolee.update({
            role
        });
        res.status(200).json({ message: 'Role updated successfully.', rolee });  
    }catch(err){
        console.log("error is:::",err);
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err);
    }
}

//RBAC
// Create a new Admin
exports.createAdmin = async (req, res) => {
    try {
        const { name, username, password, role } = req.body;

        // Check if the username already exists
        const existingAdmin = await Admin.findAll({ where: { username } });
        if (existingAdmin.length > 0) {
            return res.status(400).json({ message: "Username already exists" });
        }

        // Hash the password before storing
        const hashedPassword = await bcrypt.hash(password, 10);

        // Find role by ID
        const roleRecord = await Role.findByPk(role);
        if (!roleRecord) {
            return res.status(400).json({ message: "Invalid role ID" });
        }

        // Create the admin
        const admin = await Admin.create({
            name,
            username,
            password: hashedPassword,
            roleId: roleRecord.id
        });

        res.status(201).json({ message: "Admin created successfully", admin });
    } catch (error) {
        res.status(500).json({ message: "Error creating admin", error: error.message });
    }
};


// Get all Admins with their Roles
exports.getAllAdminUsers = async (req, res) => {
    try {
        const admins = await Admin.findAll({
            where:{username:{[Op.ne]: 'admin'}},
            include: [{ model: Role }]
        });
        res.status(200).json(admins);
    } catch (error) {
        res.status(500).json({ message: "Error retrieving admins", error: error.message });
    }
};

// Get a single Admin by ID
exports.getAdminById = async (req, res) => {
    try {
        const { id } = req.params;
        const admin = await Admin.findByPk(id, {
            include: [{ model: Role, attributes: ['id', 'role'] }]
        });

        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        res.status(200).json(admin);
    } catch (error) {
        res.status(500).json({ message: "Error retrieving admin", error: error.message });
    }
};

// Update an Admin
exports.updateAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, username, password, role } = req.body;

        // Find the admin
        const admin = await Admin.findByPk(id);
        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        // Find the role if provided
        let roleRecord;
        if (role) {
            roleRecord = await Role.findByPk(role);
            if (!roleRecord) {
                return res.status(400).json({ message: "Invalid role ID" });
            }
        }

        // Hash password if updated
        let hashedPassword = admin.password;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        // Update the admin
        await admin.update({
            name: name || admin.name,
            username: username || admin.username,
            password: hashedPassword,
            roleId: roleRecord ? roleRecord.id : admin.roleId
        });

        res.status(200).json({ message: "Admin updated successfully", admin });
    } catch (error) {
        res.status(500).json({ message: "Error updating admin", error: error.message });
    }
};

// Delete an Admin
exports.deleteAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        // Find the admin
        const admin = await Admin.findByPk(id);
        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        // Delete the admin
        await admin.destroy();

        res.status(200).json({ message: "Admin deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting admin", error: error.message });
    }
};

//assigning rights to roles
exports.assignRightsToRole = async (req, res) => {
    try {
        const { roleId, rights } = req.body;

        // Validate Role
        const roleExists = await Role.findByPk(roleId);
        if (!roleExists) {
            return res.status(404).json({ message: "Role not found" });
        }

        // Delete existing rights for this role
        await RolesRights.destroy({ where: { roleId } });

        // Assign new rights
        const rightsData = rights.map(right => ({ roleId, rights:right }));
        await RolesRights.bulkCreate(rightsData);

        res.status(201).json({ message: "Rights assigned successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error assigning rights", error: error.message });
    }
};

// Get rights for a role
exports.getRightsByRole = async (req, res) => {
    try {
        const { roleId } = req.params;
        const rights = await RolesRights.findAll({ where: { roleId } });

        res.status(200).json(rights);
    } catch (error) {
        res.status(500).json({ message: "Error fetching rights", error: error.message });
    }
};

//for navbar
exports.getUserRights = async (req, res) => {
    try {
        const { roleId } = req.params; // Assuming roleId is in JWT payload

        if (!roleId) {
            return res.status(400).json({ message: "Role ID is required" });
        }

        // Fetch rights associated with the user's role
        const rights = await RolesRights.findAll({
            where: { roleId },
            attributes: ['rights']
        });

        // Extract rights array
        const userRights = rights.map(right => right.rights);

        res.status(200).json({ rights: userRights });
    } catch (error) {
        res.status(500).json({ message: "Error fetching user rights", error: error.message });
    }
};