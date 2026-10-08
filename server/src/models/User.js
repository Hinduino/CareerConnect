const mongoose = require("mongoose");

// The resume is embedded in the user document instead of living in its own
// collection, so one user can only ever have one resume and it is removed
// automatically if the user document is deleted.
//
// _id: false   -> the resume has no id of its own; it is addressed through
//                 the user it belongs to.
// select: false on `data` -> ordinary user queries (login, registration
//                 checks, profile lookups) do NOT pull the file bytes. Only
//                 the download route asks for them explicitly.
const resumeSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true, select: false },
    uploadedAt: { type: Date, required: true }, // first upload
    updatedAt: { type: Date, required: true }, // last replace
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: "Unnamed User" },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["job_seeker", "recruiter"], default: "job_seeker" },
    location: { type: String },

    // Absent (not an empty object) until the user uploads a resume.
    resume: { type: resumeSchema, default: undefined },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);