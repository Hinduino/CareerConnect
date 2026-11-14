const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const requireAuth = require("../middleware/auth");
const {
  getNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require("../queries/notificationQueries");

// GET /api/notifications - Fetch logged-in user's notifications & unread count
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await getNotificationsForUser(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Server error fetching notifications" });
  }
});

// PATCH /api/notifications/read-all - Mark all notifications as read
router.patch("/read-all", requireAuth, async (req, res) => {
  try {
    await markAllNotificationsAsRead(req.user.id);
    res.status(200).json({ message: "All notifications marked as read." });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ error: "Server error updating notifications" });
  }
});

// PATCH /api/notifications/:id/read - Mark a single notification as read
router.patch("/:id/read", requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid notification ID" });
    }

    const notification = await markNotificationAsRead(req.user.id, req.params.id);
    res.status(200).json({ notification });
  } catch (error) {
    if (error.message === "Notification not found.") {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Server error updating notification" });
  }
});

module.exports = router;