const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const Notification = require("../models/Notifications");
const isAuth = require("../middleware/is-auth");

// GET /api/notifications?userId=&userType=
router.get("/", isAuth, async (req, res) => {
  const { userId, userType } = req.query;
  if (!userId || !userType) {
    return res.status(400).json({ message: "userId and userType are required" });
  }
  try {
    const notifications = await Notification.findAll({
      where: { userId, userType },
      order: [["createdAt", "DESC"]],
      limit: 50,
    });
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/notifications/read-all?userId=&userType=   (must come before /:id routes)
router.patch("/read-all", isAuth, async (req, res) => {
  const { userId, userType } = req.query;
  if (!userId || !userType) {
    return res.status(400).json({ message: "userId and userType are required" });
  }
  try {
    await Notification.update({ isRead: true }, { where: { userId, userType, isRead: false } });
    res.json({ message: "All marked as read" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", isAuth, async (req, res) => {
  try {
    const n = await Notification.findByPk(req.params.id);
    if (!n) return res.status(404).json({ message: "Not found" });
    await n.update({ isRead: true });
    res.json({ notification: n });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/notifications/:id
router.delete("/:id", isAuth, async (req, res) => {
  try {
    const n = await Notification.findByPk(req.params.id);
    if (!n) return res.status(404).json({ message: "Not found" });
    await n.destroy();
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
