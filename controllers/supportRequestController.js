const Student = require('../models/Student');
const SupportRequest = require('../models/SupportRequest');
const Teacher = require('../models/Teacher');
const { Op, Sequelize } = require("sequelize");
const Parent = require('../models/Parent');
const notify = require('../utils/notify');
const { sendEmailEvent } = require("../emails");
const notifyAdmins = require('../utils/notifyAdmins');
const { displayName } = require('../utils/notifyAudience');

// SupportRequest.priority (high|medium|normal) and Notification.priority
// (critical|warning|info) are different vocabularies — map, don't pass through.
const TICKET_PRIORITY = { high: 'warning', medium: 'info', normal: 'info' };


// Create a new support request
exports.createSupportRequest = async (req, res) => {
  try {
    const { title, problem, userId, userType, priority } = req.body;
    const newRequest = await SupportRequest.create({
      title,
      problem,
      userId,
      userType,
      priority,
    });

    try {
      const model = userType === 'teacher' ? Teacher : userType === 'parent' ? Parent : Student;
      const person = await model.findByPk(userId);
      await notifyAdmins({
        title: 'Support Request Received',
        message: `${displayName(person, `A ${userType}`)} raised a support request: "${title}".`,
        priority: TICKET_PRIORITY[priority] || 'info',
      });
      await notify({
        userId,
        userType,
        title: 'Support Request Received',
        message: `We received your support request "${title}" and will get back to you.`,
      });
      sendEmailEvent('support.request_created', {
        request: newRequest,
        requesterName: displayName(person, `A ${userType}`),
        requesterType: userType,
      });
    } catch (notifErr) {
      console.error('Notification error (non-fatal):', notifErr.message);
    }

    res.status(201).json(newRequest);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create support request', error });
  }
};

// Get all support requests (admin view)
exports.getAllSupportRequests = async (req, res) => {
    try {
      const requests = await SupportRequest.findAll({
        include: [
          {
            model: Student,
            as: 'student',
            attributes: ['firstName', 'lastName', 'profileImg'],
            required: false,
            where: {
              id: Sequelize.col('SupportRequest.userId'),
              '$SupportRequest.userType$': 'student',  // Adjust this condition as needed
            },
          },
          {
            model: Teacher,
            as: 'teacher',
            attributes: ['firstName', 'lastName', 'imageUrl'],
            required: false,
            where: {
              id: Sequelize.col('SupportRequest.userId'),
              '$SupportRequest.userType$': 'teacher',  // Adjust this condition as needed
            },
          },
        ],
        order: [['createdAt', 'DESC']],
      });
      res.status(200).json(requests);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Failed to fetch support requests', error });
    }
  };
  
exports.getSupportRequestsByUser = async (req, res) => {
    const { userId, userType } = req.params;
   
    try {
      // Dynamically set up the include array based on userType
      const includeOptions = [];
      if (userType === 'student') {
        includeOptions.push({
          model: Student,
          as: 'student',
          attributes: ['firstName', 'lastName', 'profileImg'],
        });
      } else if (userType === 'teacher') {
        includeOptions.push({
          model: Teacher,
          as: 'teacher',
          attributes: ['firstName', 'lastName', 'imageUrl'],
        });
      }
  
      const requests = await SupportRequest.findAll({
        where: { userId, userType },
        include: includeOptions, // Only include the relevant model
      });
      res.status(200).json(requests);
    } catch (error) {
        console.log(error)
      res.status(500).json({ message: 'Failed to fetch support requests', error });
    }
  };
  

// Get a single support request by ID
exports.getSupportRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await SupportRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ message: 'Support request not found' });
    }
    res.status(200).json(request);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch support request', error });
  }
};

// Update a support request by ID
exports.updateSupportRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, problem, priority, responseFromAdmin, status } = req.body;
    const request = await SupportRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ message: 'Support request not found' });
    }

    // Capture what an admin is about to change, before the merge below.
    const hadResponse = request.responseFromAdmin;
    const previousStatus = request.status;

    // Update fields
    request.title = title || request.title;
    request.problem = problem || request.problem;
    request.priority = priority || request.priority;
    request.responseFromAdmin = responseFromAdmin || request.responseFromAdmin;
    request.status = status || request.status;

    await request.save();

    try {
      const newResponse = request.responseFromAdmin && request.responseFromAdmin !== hadResponse;
      const newStatus = request.status !== previousStatus;
      if (newResponse || newStatus) {
        const resolved = request.status === 'resolved';
        const rejected = request.status === 'rejected';
        await notify({
          userId: request.userId,
          userType: request.userType,
          title: rejected ? 'Support Request Rejected'
            : resolved ? 'Support Request Resolved'
            : 'Support Request Updated',
          message: newResponse
            ? `Support replied to "${request.title}": ${request.responseFromAdmin}`
            : `Your support request "${request.title}" is now ${request.status}.`,
          priority: rejected ? 'warning' : 'info',
        });

        // Only email when an admin actually wrote something back. A status-only
        // edit is not an answer, and emailing one trains people to ignore these.
        if (newResponse) {
          sendEmailEvent('support.request_answered', {
            request,
            userRole: request.userType,
            user: { id: request.userId },
            ...(request.userType === 'teacher'
              ? { teacherId: request.userId }
              : request.userType === 'parent'
                ? { parentId: request.userId }
                : { studentId: request.userId }),
          });
        }
      }
    } catch (notifErr) {
      console.error('Notification error (non-fatal):', notifErr.message);
    }

    res.status(200).json(request);
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Failed to update support request', error });
  }
};

// Delete a support request by ID
exports.deleteSupportRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await SupportRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ message: 'Support request not found' });
    }

    await request.destroy();
    res.status(200).json({ message: 'Support request deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete support request', error });
  }
};
