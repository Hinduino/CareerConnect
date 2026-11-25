const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // REFACTORED (SCRUM-371): Added INTERVIEW_INVITATION and APPLICATION_WITHDRAWN
    // to support dedicated interview notifications and candidate withdrawal alerts.
    type: {
      type: String,
      enum: [
        "APPLICATION_SUBMITTED",
        "APPLICATION_STATUS",
        "INTERVIEW_INVITATION",
        "APPLICATION_WITHDRAWN",
        "REMINDER",
        "SYSTEM",
      ],
      default: "SYSTEM",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    relatedJob: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobPosting",
      default: null,
    },
    relatedApplication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      default: null,
    },
    dedupeKey: {
      type: String,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

module.exports =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);