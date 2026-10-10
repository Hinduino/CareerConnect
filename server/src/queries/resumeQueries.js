const User = require("../models/User");

// Every function here works on the `resume` field embedded in a User
// document. There is no Resume model and no `resumes` collection anymore.

// Metadata fields only. Listed one by one (rather than selecting "resume")
// so the file bytes in resume.data are never loaded by accident.
const RESUME_META = "resume.originalName resume.contentType resume.size";

// A user "has a resume" when the embedded file bytes exist.
const HAS_RESUME = { "resume.data": { $exists: true } };
const HAS_NO_RESUME = { "resume.data": { $exists: false } };

function resumeOf(user) {
  return user && user.resume ? user.resume : null;
}

// Resume metadata without the file bytes. Returns null if there is none.
async function findResumeMetaByUser(userId) {
  const user = await User.findById(userId).select(RESUME_META);
  return resumeOf(user);
}

// Resume including the file bytes (for the download route).
// The "+" overrides select: false on resume.data for this one query.
async function findResumeByUser(userId) {
  const user = await User.findById(userId).select(
    "resume.originalName resume.contentType +resume.data"
  );
  return resumeOf(user);
}

// Embeds a new resume in the user document. The filter only matches a user
// who has no resume yet, so two simultaneous uploads cannot overwrite each
// other. Returns null if the user already has one (or does not exist).
async function createResume(userId, file) {
  const user = await User.findOneAndUpdate(
    { _id: userId, ...HAS_NO_RESUME },
    {
      $set: {
        resume: {
          originalName: file.originalName,
          contentType: file.contentType,
          size: file.size,
          data: file.data,
        },
      },
    },
    { new: true, runValidators: true }
  ).select(RESUME_META);
  return resumeOf(user);
}

// Swaps the file in place. If the user has no resume yet, this falls back
// to creating one. Returns null only if the user does not exist.
async function replaceResume(userId, file) {
  const user = await User.findOneAndUpdate(
    { _id: userId, ...HAS_RESUME },
    {
      $set: {
        "resume.originalName": file.originalName,
        "resume.contentType": file.contentType,
        "resume.size": file.size,
        "resume.data": file.data,
      },
    },
    { new: true, runValidators: true }
  ).select(RESUME_META);

  if (user) return resumeOf(user);
  return createResume(userId, file);
}

// Removes the embedded resume field from the user document.
// Returns true if a resume was removed, false if there was none.
async function deleteResumeByUser(userId) {
  const user = await User.findOneAndUpdate(
    { _id: userId, ...HAS_RESUME },
    { $unset: { resume: 1 } }
  ).select("_id");
  return Boolean(user);
}

module.exports = {
  findResumeByUser,
  findResumeMetaByUser,
  createResume,
  replaceResume,
  deleteResumeByUser,
};