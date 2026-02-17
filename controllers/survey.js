const Survey = require("../models/Survey");
const { Op,Sequelize } = require('sequelize');
const UpcomingClass = require("../models/UpcomingClasses");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");

exports.submitSurvey = async(req, res, next) => {
    try {
        const {
          studentId,
          classId,
          teacherId,
          classRating,
          lessonRating,
          teacherRating,
          feedback
        } = req.body;
  
        const survey = await Survey.create({
          studentId,
          classId,
          teacherId,
          classRating,
          lessonRating,
          teacherRating,
          feedback,
          completed: true
        });
  
        res.status(201).json({
          success: true,
          data: survey
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    
  };

  exports.checkPendingSurvey = async(req, res, next) => {
    try {
        const { studentId } = req.params;
        const survey = await Survey.findOne({where: {studentId: studentId, completed: false}});
        res.status(200).json({survey});
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    
  };

  exports.getStudentSurveys = async(req, res, next) => {
    try {
        const { studentId } = req.params;
        const surveys = await Survey.findAll({where: {studentId: studentId}});
        res.status(200).json({surveys});
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    
  };


  exports.getDashboardStats = async(req, res, next) => {
    try {
        const { teacherId } = req.params;
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        // Base query conditions
        const whereCondition = {
          createdAt: {
            [Op.gte]: thirtyDaysAgo
          }
        };
        
        // Add teacherId condition if provided
        if (teacherId) {
          whereCondition.teacherId = teacherId;
        }
  
        // Get total responses
        const totalResponses = await Survey.count({
          where: whereCondition
        });
  
        // Get average rating
        const avgRating = await Survey.findOne({
          where: whereCondition,
          attributes: [
            [Sequelize.fn('AVG', Sequelize.col('classRating')), 'avgClassRating'],
            [Sequelize.fn('AVG', Sequelize.col('teacherRating')), 'avgTeacherRating'],
            [Sequelize.fn('AVG', Sequelize.col('lessonRating')), 'avgLessonRating']
          ],
          raw: true
        });
  
        // Get previous month's average for trend
        const prevMonthAvg = await Survey.findOne({
          where: {
            ...whereCondition,
            createdAt: {
              [Op.lt]: thirtyDaysAgo,
              [Op.gte]: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
            }
          },
          attributes: [
            [Sequelize.fn('AVG', 
              Sequelize.literal('(classRating + teacherRating + lessonRating) / 3')
            ), 'avgRating']
          ],
          raw: true
        });
  
        // Get total classes and rated classes
        const classStats = await UpcomingClass.findOne({
          where: {
            date: {
              [Op.gte]: thirtyDaysAgo
            },
            ...(teacherId && { teacherId })
          },
          attributes: [
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'totalClasses'],
            [Sequelize.fn('COUNT', 
              Sequelize.literal('CASE WHEN EXISTS (SELECT 1 FROM Survey WHERE Survey.classId = UpcomingClass.id) THEN 1 END')
            ), 'ratedClasses']
          ],
          raw: true
        });
        // console.log("rating trend::", parseFloat(avgRating.avgRating || 0) - parseFloat(prevMonthAvg.avgRating || 0))
        res.json({
          success: true,
          data: {
            averageRating: (
                (
                    parseFloat(avgRating.avgClassRating || 0) +
                    parseFloat(avgRating.avgTeacherRating || 0) +
                    parseFloat(avgRating.avgLessonRating || 0)
                  ) / 3
            ).toFixed(1),
            totalResponses,
            responseRate: ((classStats.ratedClasses / classStats.totalClasses) * 100).toFixed(1),
            classesRated: `${classStats.ratedClasses}/${classStats.totalClasses}`,
            ratingTrend: (
                parseFloat(avgRating.avgRating || 0) - parseFloat(prevMonthAvg.avgRating || 0)
            ).toFixed(1)
          }
        });
      } catch (error) {
        console.log("error", error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
  };

  exports.getRatingDistribution = async(req, res, next) => {
    try {
        const { teacherId } = req.params;
        
        const distribution = await Survey.findAll({
          where: teacherId ? { teacherId } : {},
          attributes: [
            'classRating',
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
          ],
          group: ['classRating'],
          raw: true
        });
  
        const formattedDistribution = distribution.reduce((acc, curr) => {
          acc[curr.classRating] = parseInt(curr.count);
          return acc;
        }, {});
  
        res.json({
          success: true,
          data: formattedDistribution
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }

    exports.getRatingTrend = async(req, res, next) => {
        try {
            const { teacherId } = req.params;
            const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      
            const trend = await Survey.findAll({
              where: {
                createdAt: {
                  [Op.gte]: sixMonthsAgo
                },
                ...(teacherId && { teacherId })
              },
              attributes: [
                [Sequelize.fn('DATE_FORMAT', Sequelize.col('createdAt'), '%Y-%m'), 'month'],
                [Sequelize.fn('AVG', 
                  Sequelize.literal('(classRating + teacherRating + lessonRating) / 3')
                ), 'rating']
              ],
              group: [Sequelize.fn('DATE_FORMAT', Sequelize.col('createdAt'), '%Y-%m')],
              order: [[Sequelize.col('month'), 'ASC']],
              raw: true
            });
      
            res.json({
              success: true,
              data: trend
            });
          } catch (error) {
            res.status(500).json({
              success: false,
              error: error.message
            });
          }
        }

    exports.getRecentFeedback = async(req, res, next) => {
        try {
            const { teacherId, page = 1, limit = 10 } = req.params;
      
            const feedback = await Survey.findAll({
              where: teacherId ? { teacherId } : {},
              include: [
                {
                  model: Student,
                  as: 'Student',
                  attributes: ['firstName', 'lastName','id','profileImg']
                },
                {
                  model: Teacher,
                  as: 'Teacher',
                  attributes: ['firstName', 'lastName','id','imageUrl']
                }
              ],
              order: [['createdAt', 'DESC']],
              limit: parseInt(limit),
              offset: (page - 1) * limit,
              attributes: [
                'id',
                'classRating',
                'teacherRating',
                'lessonRating',
                'feedback',
                'createdAt'
              ]
            });
      
            const total = await Survey.count({
              where: teacherId ? { teacherId } : {}
            });
      
            res.json({
              success: true,
              data: {
                feedback,
                pagination: {
                  total,
                  pages: Math.ceil(total / limit),
                  currentPage: parseInt(page)
                }
              }
            });
          } catch (error) {
            res.status(500).json({
              success: false,
              error: error.message
            });
          }
        }