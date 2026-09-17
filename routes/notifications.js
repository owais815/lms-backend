const express = require("express");
const router = express.Router();
const Notification = require("../models/Notifications");
const isAuth = require("../middleware/is-auth");

// The JWT carries userType in UPPERCASE ('ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT')
// while notify() writes it lowercase. Always derive the owner from the token —
// never from the query string, or any user can read anyone else's notifications.
const actor = (req) => ({
  userId: req.userId,
  userType: (req.userType || "").toLowerCase(),
});

// A notification belongs to the caller only if both id and type match.
// req.userId is a string (jwt.sign uses user.id.toString()); userId is INTEGER.
const isOwner = (n, me) =>
  String(n.userId) === String(me.userId) && n.userType === me.userType;

// GET /api/notifications  — query params are ignored; the token decides.
router.get("/", isAuth, async (req, res) => {
  const me = actor(req);
  try {
    const notifications = await Notification.findAll({
      where: { userId: me.userId, userType: me.userType },
      order: [["createdAt", "DESC"]],
      limit: 50,
    });
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/notifications/read-all   (must come before /:id routes)
router.patch("/read-all", isAuth, async (req, res) => {
  const me = actor(req);
  try {
    await Notification.update(
      { isRead: true },
      { where: { userId: me.userId, userType: me.userType, isRead: false } }
    );
    res.json({ message: "All marked as read" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", isAuth, async (req, res) => {
  try {
    const n = await Notification.findByPk(req.params.id);
    // 404 rather than 403 on a foreign row — a 403 would confirm it exists.
    if (!n || !isOwner(n, actor(req))) {
      return res.status(404).json({ message: "Not found" });
    }
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
    if (!n || !isOwner(n, actor(req))) {
      return res.status(404).json({ message: "Not found" });
    }
    await n.destroy();
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
