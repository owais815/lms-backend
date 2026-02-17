const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Role = require("../models/Roles");
const Rights = require("../models/Rights");
const AdminRights = require("../models/AdminRights");
const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const CourseDetails = require("../models/CourseDetails");
const Courses = require("../models/Course");
const { Sequelize, where } = require("sequelize");



exports.addCourse = async (req, res, next) => {
  try {
      // console.log("alisherabbasiii:::",req.body.studentId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          const error = new Error('Validation failed.');
          error.statusCode = 422;
          error.data = errors.array();
          throw error;
      }

      const { courseId, teacherId, studentId } = req.body;
      const isExisted = await CourseDetails.findOne({
          where: {
              courseId,
              teacherId,
              studentId
          }
      });

      if (isExisted) {
          const error = new Error('Course already exists.');
          error.statusCode = 409;
          throw error;
      }

      const newCourse = await CourseDetails.create({
          courseId,
          teacherId,
          studentId
      });

      res.status(201).json({
          message: 'Course added successfully',
          course: newCourse
      });
  } catch (error) {
      if (!error.statusCode) {
          error.statusCode = 500;
      }
      next(error);
  }
};

exports.deleteCourse = (req, res, next) => {
  const courseId = req.params.courseId; // Get adminId from URL params

  // Find the Teacher record by ID and delete it
  CourseDetails.findByPk(courseId)
      .then(course => {
          if (!course) {
              const error = new Error('Course not found.');
              error.statusCode = 404;
              throw error;
          }

          // Delete the course record
          return course.destroy();
      })
      .then(() => {
          // Send success response
          res.status(200).json({ message: 'Course deleted successfully.' });
      })
      .catch(err => {
          // Handle errors
          if (!err.statusCode) {
              err.statusCode = 500;
          }
          next(err);
      });
};

exports.updateCourse = (req, res, next) => {
  const courseId = req.params.courseId; // Assuming teacherId is passed in the URL params
  const updateFields = {};
  
  // Extract fields that can be updated from the request body
  const { courseName, duration, description, teacherId, studentId } = req.body;

  // Add the update fields to the updateFields object if they are provided
  if (courseName) {
      updateFields.courseName = courseName;
  }
  if (duration) {
      updateFields.duration = duration;
  }
  if (description) {
      updateFields.description = description;
  }
  if (teacherId) {
      updateFields.teacherId = teacherId;
  }
  if (studentId) {
      updateFields.studentId = studentId;
  }

  CourseDetails.findByPk(courseId)
      .then(course => {
          if (!course) {
              const error = new Error('Course not found.');
              error.statusCode = 404;
              throw error;
          }
          
          return course.update(updateFields);
      })
      .then(updatedCourse => {
          // Return success response with the updated Teacher details
          res.status(200).json({ message: 'Course updated successfully.', admin: updatedCourse });
      })
      .catch(err => {
          if (!err.statusCode) {
              err.statusCode = 500;
          }
          next(err);
      });
};

exports.getCourseById = (req, res, next) => {
  const courseId = req.params.courseId;
  // Query the database to retrieve all Admin records
  CourseDetails.findOne({where:{id:courseId} ,
    include:[
        {model:Teacher,
            as:'Teacher',
            attributes:['id','firstName','lastName','email','username']
        },
        {model:Student,
            as:'Student',
            attributes:['id','firstName','lastName','email','username']
        },
        {
            model:Courses
        }
    ]})
      .then(course => {
          if (!course) {
              const error = new Error('course not found.');
              error.statusCode = 404;
              throw error;
          }
          // Send success response with the retrieved Admin records
          res.status(200).json({ course: course });
      })
      .catch(err => {
          // Handle errors
          if (!err.statusCode) {
              err.statusCode = 500;
          }
          next(err);
      });
};

exports.getCourseByStdId = (req, res, next) => {
  const stdId = req.params.stdId;
  // Query the database to retrieve all Admin records
  CourseDetails.findAll({where:{studentId:stdId}
    ,
    include:[
        {model:Teacher,
            as:'Teacher',
            attributes:['id','firstName','lastName','email','username','imageUrl']
        },
        {model:Student,
            as:'Student',
            attributes:['id','firstName','lastName','email','username']
        },
        {
            model: Courses,
          }
    ]

})
      .then(course => {
          if (!course) {
              const error = new Error('course not found.');
              error.statusCode = 404;
              throw error;
          }
          // Send success response with the retrieved Admin records
          res.status(200).json({ course: course });
      })
      .catch(err => {
          // Handle errors
          if (!err.statusCode) {
              err.statusCode = 500;
          }
          next(err);
      });
};

exports.getCourseByTeacherId = (req, res, next) => {
  const teacherId = req.params.teacherId;
  // Query the database to retrieve all Admin records
  CourseDetails.findAll({
    where:{teacherId:teacherId},
    include:[
        {model:Teacher,
            as:'Teacher',
            attributes:['id','firstName','lastName','email','username']
        },
        {model:Student,
            as:'Student',
            attributes:['id','firstName','lastName','email','username','profileImg','nameForTeacher']
        },{
            model:Courses
        }
    ]
}
  )
      .then(course => {
          if (!course) {
              const error = new Error('course not found.');
              error.statusCode = 404;
              throw error;
          }
          // Send success response with the retrieved Admin records
          res.status(200).json({ course: course });
      })
      .catch(err => {
          // Handle errors
          if (!err.statusCode) {
              err.statusCode = 500;
          }
          next(err);
      });
};

exports.getCourseByStdAndTeacherId = (req, res, next) => {
    const stdId = req.params.stdId;
    const teacherId = req.params.teacherId;
    // Query the database to retrieve all Admin records
    CourseDetails.findAll({where:{studentId:stdId,teacherId:teacherId}
      ,
      include:[
          {model:Teacher,
              as:'Teacher',
              attributes:['id','firstName','lastName','email','username']
          },
          {model:Student,
              as:'Student',
              attributes:['id','firstName','lastName','email','username']
          },
          {
              model: Courses,
            }
      ]
  
  })
        .then(course => {
            if (!course) {
                const error = new Error('course not found.');
                error.statusCode = 404;
                throw error;
            }
            // Send success response with the retrieved Admin records
            res.status(200).json({ course: course });
        })
        .catch(err => {
            // Handle errors
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        });
  };

 // Modified function to handle an array of studentIds
exports.getCourseByStdAndCourseIds = (req, res, next) => {
    const { studentIds, courseId } = req.body;
  
    CourseDetails.findAll({
      where: {
        studentId: studentIds, // Use an array of IDs
        courseId
      }
    })
      .then(courses => {
        const approvedStudents = courses.map(course => course.studentId);
        res.status(200).json({ approvedStudents });
      })
      .catch(err => {
        if (!err.statusCode) {
          err.statusCode = 500;
        }
        next(err);
      });
  };
  
  
exports.getCourses = (req, res, next) => {
    // Query the database to retrieve all Admin records
    CourseDetails.findAll( {include:[
        {model:Teacher,
            as:'Teacher',
            attributes:['id','firstName','lastName','email','username']
        },
        {model:Student,
            as:'Student',
            attributes:['id','firstName','lastName','email','username']
        },
        {
            model: Courses
        }
    ]})
        .then(course => {
            if (!course) {
                const error = new Error('course not found.');
                error.statusCode = 404;
                throw error;
            }
            // Send success response with the retrieved Admin records
            res.status(200).json({ course: course });
        })
        .catch(err => {
            // Handle errors
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        });
  };

  exports.getUniqueCourses = (req, res, next) => {
    // Query the database to retrieve all Admin records
    CourseDetails.findAll(
       
        {
            attributes: [
                // Distinct courseId selection
                [Sequelize.literal('DISTINCT `CourseDetails`.`courseId`'), 'courseId'],
                'id', // include the primary key or any other column needed from CourseDetails
            ],
            include:[
        {model:Teacher,
            as:'Teacher',
            attributes:['id','firstName','lastName','email','username']
        },
        {model:Student,
            as:'Student',
            attributes:['id','firstName','lastName','email','username']
        },
        {
            model: Courses
        }
    ],
})
        .then(course => {
            if (!course) {
                const error = new Error('course not found.');
                error.statusCode = 404;
                throw error;
            }
            // Send success response with the retrieved Admin records
            res.status(200).json({ course: course });
        })
        .catch(err => {
            // Handle errors
            if (!err.statusCode) {
                err.statusCode = 500;
            }
            next(err);
        });
  };