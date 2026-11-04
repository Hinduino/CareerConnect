const mongoose = require("mongoose");

// A snapshot of the resume the applicant selected at submission time. This
// is copied from the applicant's saved Resume document rather than
// referenced by id, so the recruiter always sees exactly what was attached
// even if the applicant later edits or deletes that saved resume.
const applicationResumeSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true, select: false },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: "JobPosting", required: true },
    status: {
      type: String,
      enum: ["Applied", "Under Review", "Interview", "Offered", "Rejected"],
      default: "Applied",
    },
    resume: { type: applicationResumeSchema, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Application || mongoose.model("Application", applicationSchema);
