const { createHash } = require("crypto");
const Notification = require("../models/Notification");

function getNotificationDedupeKey({
  recipient,
  type,
  title,
  relatedJob,
  relatedApplication,
}) {
  const identity = [
    String(recipient),
    type,
    title,
    relatedJob ? String(relatedJob) : null,
    relatedApplication ? String(relatedApplication) : null,
  ];

  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}

async function createNotification({
  recipient,
  type = "SYSTEM",
  title,
  message,
  relatedJob = null,
  relatedApplication = null,
  dedupeKey,
}) {
  if (!recipient || !title || !message) {
    return null;
  }

  const key =
    dedupeKey ||
    getNotificationDedupeKey({ recipient, type, title, relatedJob, relatedApplication });
  const existingNotification = await Notification.findOne({ dedupeKey: key });
  if (existingNotification) {
    return existingNotification;
  }

  const notification = {
    recipient,
    type,
    title,
    message,
    relatedJob,
    relatedApplication,
    dedupeKey: key,
  };

  try {
    return await Notification.create(notification);
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }

    const duplicate = await Notification.findOne({ dedupeKey: key });
    if (duplicate) {
      return duplicate;
    }
    throw error;
  }
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