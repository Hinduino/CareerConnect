const mongoose = require("mongoose");
const { APPLICATION_STATUS_VALUES } = require("../constants/applicationStatus");

const applicationSchema = new mongoose.Schema(
  {
    applicant: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    job: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "JobPosting", 
      required: true 
    },
    status: {
      type: String,
      enum: APPLICATION_STATUS_VALUES,
      default: "Applied",
    },
    resume: {
      originalName: { type: String },
      contentType: { type: String },
      size: { type: Number },
      data: { type: Buffer, select: false },
    },
    declinedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    }
  },
  { timestamps: true }
);

applicationSchema.index({ applicant: 1, job: 1 }, { unique: true });
applicationSchema.index({ job: 1, status: 1 });
applicationSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Application || mongoose.model("Application", applicationSchema);
