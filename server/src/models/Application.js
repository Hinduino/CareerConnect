const mongoose = require("mongoose");

// Every status an application can have. Exported so the endpoints
// (SCRUM-164) and the status view (SCRUM-166) share one list.
const APPLICATION_STATUSES = ["Applied", "Under Review", "Interview", "Offered", "Rejected"];

// One entry per status change, so users can see how their application
// progressed over time (SCRUM-166).
const statusChangeSchema = new mongoose.Schema(
  {
    status: { type: String, enum: APPLICATION_STATUSES, required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: "JobPosting", required: true },
    status: { type: String, enum: APPLICATION_STATUSES, default: "Applied" },
    statusHistory: {
      type: [statusChangeSchema],
      default: () => [{ status: "Applied" }],
    },
  },
  { timestamps: true }
);

// A user can only apply to a given job once.
applicationSchema.index({ applicant: 1, job: 1 }, { unique: true });

const Application = mongoose.model("Application", applicationSchema);

module.exports = Application;
module.exports.APPLICATION_STATUSES = APPLICATION_STATUSES;