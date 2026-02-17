const MyBookmark = require('../models/Bookmarks/MyBookmark');
const Student = require('../models/Student');
const CourseDetails = require('../models/CourseDetails');
const { AdminFeedback, Courses, Teacher } = require('../models/association');
const { Op } = require('sequelize');


exports.addFeedback = async (req, res) => {
    try {
      const { areasToImprove, feedback,progressInGrades, studentId, courseDetailsId,teacherId } = req.body;
  
      // Ensure student and course exist
      const student = await Student.findByPk(studentId);
      const course = await CourseDetails.findByPk(courseDetailsId);
  
      if (!student || !course) {
        return res.status(404).json({ message: 'Student or Course not found' });
      }
  
      // let adminFeedback = await AdminFeedback.findOne({
      //   where: { studentId, courseDetailsId }
      // });
  
      // if (adminFeedback) {
      //   // If it exists, toggle the bookmark status
      //   adminFeedback.feedback = feedback;
      //   adminFeedback.areasToImprove = areasToImprove;
      //   adminFeedback.progressInGrades = progressInGrades;
      //   await adminFeedback.save();
      //   return res.status(200).json({ message: 'Feedback updated', adminFeedback });
      // }
  
      let adminFeedback = await AdminFeedback.create({
        feedback,
        areasToImprove,
        progressInGrades,
        studentId,
        courseDetailsId,
        teacherId
      });
  
      return res.status(201).json({ message: 'Feedback Submitted', adminFeedback });
    } catch (error) {
      console.log("adminFeedback updating", error);
      return res.status(500).json({ error: 'Failed to add Feedback' });
    }
  };
exports.getFeedback = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const adminFeedback = await AdminFeedback.findAll({ where: { studentId,teacherId:null },
      include: [
        {
          model: CourseDetails,
          include: [
            {
              model: Courses,
              attributes: ['courseName'],
            },
          ],
        },
      ], },
      
    );
    return res.status(200).json(adminFeedback);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch feedback' });
  }
};

exports.getTeacherFeedbacks = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const adminFeedback = await AdminFeedback.findAll({ where: { studentId,teacherId: { [Op.ne]: null } },
      include: [
        {
          model: CourseDetails,
          include: [
            {
              model: Courses,
              attributes: ['courseName'],
            },
            
          ],
        },
        {
          model: Teacher,
          attributes: ["id", "firstName", "lastName","imageUrl"]
        }
      ], },
      
    );
    return res.status(200).json(adminFeedback);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch feedback' });
  }
};

//get all feedbacks
exports.getAllFeedbacks = async (req, res) => {
  try {
    const adminFeedback = await AdminFeedback.findAll({ include: [
      {
        model: CourseDetails,
        include: [
          {
            model: Courses,
            attributes: ['courseName'],
          },
        ],
      },
      {
        model: Student,
        attributes: ["id", "firstName", "lastName","profileImg"]
      },
      {
        model: Teacher,
        attributes: ["id", "firstName", "lastName","imageUrl"]
      }
    ]});
    return res.status(200).json(adminFeedback);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch feedback' });
  }
};
//delete feedback
exports.deleteFeedback = async (req, res) => {
  const { feedbackId } = req.params;
  try {
    const feedback = await AdminFeedback.findByPk(feedbackId);
    if (!feedback) {
      return res.status(404).json({ message: 'Feedback not found' });
    }
    await feedback.destroy();
    return res.status(200).json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete feedback' });
  }
};
  