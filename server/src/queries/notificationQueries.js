const Notification = require("../models/Notification");

async function createNotification({
  recipient,
  type = "SYSTEM",
  title,
  message,
  relatedJob = null,
  relatedApplication = null,
}) {
  if (!recipient || !title || !message) {
    return null;
  }

  return Notification.create({
    recipient,
    type,
    title,
    message,
    relatedJob,
    relatedApplication,
  });
}

async function getNotificationsForUser(userId) {
  const notifications = await Notification.find({ recipient: userId })
    .sort({ createdAt: -1 })
    .limit(50);

  const unreadCount = await Notification.countDocuments({
    recipient: userId,
    isRead: false,
  });

  return { notifications, unreadCount };
}

async function markNotificationAsRead(userId, notificationId) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    throw new Error("Notification not found.");
  }

  return notification;
}

async function markAllNotificationsAsRead(userId) {
  await Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true } }
  );
}

module.exports = {
  createNotification,
  getNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};