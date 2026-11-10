const mongoose = require("mongoose");

// A snapshot of the resume the applicant selected at submission time. This
// is copied from the applicant's saved Resume document rather than
// referenced by id, so the recruiter always sees exactly what was attached
// even if the applicant later edits or deletes that saved resume.
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
      enum: [
        "Applied", 
        "Under Review", 
        "under review", 
        "Interview", 
        "Interviewing", 
        "Offered", 
        "Rejected", 
        "Offer Declined", 
        "Cancelled"
      ],
      default: "Applied",
    },
    resume: {
      originalName: { type: String },
      contentType: { type: String },
      size: { type: Number },
      data: { type: Buffer },
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

module.exports = mongoose.models.Application || mongoose.model("Application", applicationSchema);
