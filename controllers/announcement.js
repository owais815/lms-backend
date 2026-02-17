


// POST: Admin creates a new announcement
exports.createAnnouncement = async (req, res) => {
    try {
        const { title, message, scheduledTime, userType, userId, startDate, endDate } = req.body;
        
        // Validate scheduledTime against current time
        if (new Date(scheduledTime) < new Date()) {
            return res.status(400).json({ error: 'Scheduled time cannot be in the past.' });
        }

        const announcement = await Announcements.create({
            title,
            message,
            scheduledTime,
            userType,
            userId,
            startDate,
            endDate
        });

        res.status(201).json({ announcement });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create announcement.' });
    }
};

// GET: Students/Teachers view announcements
exports.getAnnouncements = async (req, res) => {
    try {
        const { userType } = req.query;

        if (!userType || (userType !== 'student' && userType !== 'teacher')) {
            return res.status(400).json({ error: 'Invalid user type specified.' });
        }

        const currentTime = new Date();

        const announcements = await Announcements.findAll({
            where: {
                userType,
                startDate: { [Op.lte]: currentTime },
                endDate: { [Op.gte]: currentTime },
                scheduledTime: { [Op.lte]: currentTime }
            },
            order: [['scheduledTime', 'DESC']]
        });

        res.status(200).json({ announcements });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve announcements.' });
    }
};
