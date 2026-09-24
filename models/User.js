const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: "Unnamed User" },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["job_seeker", "recruiter"], default: "job_seeker" },
    location: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);