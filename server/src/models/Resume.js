const mongoose = require("mongoose");

// Each applicant can save multiple resumes and choose one per application.
// The file bytes live on this document (not on User) so a user can have any
// number of them. `select: false` on `data` keeps list queries from pulling
// the file bytes by accident; only the download route asks for them.
const resumeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    originalName: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Resume || mongoose.model("Resume", resumeSchema);
