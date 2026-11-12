const mongoose = require("mongoose");

// Resumes live in their own collection (see models/Resume.js) since a user
// can save more than one and pick which to attach per application.
//
// Same embedding pattern is kept for the profile photo: one user has at
// most one, and select: false on `data` keeps ordinary user queries (login,
// registration checks, profile lookups) from pulling the file bytes. Only
// the download route asks for them explicitly.
const profilePictureSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true, select: false },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: "", trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["job_seeker", "recruiter"], default: "job_seeker" },
    location: { type: String, default: "", trim: true },
    bio: { type: String, default: "", trim: true },

    // Absent until the user uploads a profile picture.
    profilePicture: { type: profilePictureSchema, default: undefined },
    
    // SCRUM-281: Array of JobPosting ObjectIds saved/favorited by a job seeker
    savedJobs: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "JobPosting" }],
      default: [],
    },
  }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);