const { createHash } = require("crypto");
const Notification = require("../models/Notification");

const DEFAULT_DEDUPE_WINDOW_MS = 60 * 1000; // 1 minute to suppress accidental double-submits

// REFACTORED (SCRUM-371): Include a 1-minute time bucket in default dedupe keys so
// true rapid duplicates are suppressed while repeated status transitions
// (e.g., Interview -> Offered -> Interview) still generate new notifications.
function getNotificationDedupeKey(
  { recipient, type, title, message, relatedJob, relatedApplication },
  nowMs = Date.now()
) {
  const timeBucket = Math.floor(nowMs / DEFAULT_DEDUPE_WINDOW_MS);
  const identity = [
    String(recipient),
    type,
    title,
    message,
    relatedJob ? String(relatedJob) : null,
    relatedApplication ? String(relatedApplication) : null,
    timeBucket,
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
    getNotificationDedupeKey({
      recipient,
      type,
      title,
      message,
      relatedJob,
      relatedApplication,
    });
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

// REFACTORED (SCRUM-371): Non-blocking notification wrapper so a notification DB failure
// is logged but never causes applying, status updates, offer declines, or withdrawals to fail.
async function createNotificationSafe(payload) {
  try {
    return await createNotification(payload);
  } catch (error) {
    console.error("Non-blocking notification error:", error);
    return null;
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
  createNotificationSafe,
  getNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};