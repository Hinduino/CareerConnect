const Resume = require("../models/Resume");

// Metadata fields only, listed one by one (rather than selecting a single
// "resume" path) so the file bytes in `data` are never loaded by accident.
const RESUME_META = "_id originalName contentType size createdAt";

// All of the logged-in user's resumes, most recently uploaded first.
async function listResumesByUser(userId) {
  return Resume.find({ user: userId }).select(RESUME_META).sort({ createdAt: -1 });
}

// A single resume's metadata, scoped to its owner. Returns null if it
// doesn't exist or belongs to someone else.
async function findResumeMetaById(resumeId, userId) {
  return Resume.findOne({ _id: resumeId, user: userId }).select(RESUME_META);
}

// Resume including the file bytes (for the download route), scoped to its
// owner.
async function findResumeByIdForUser(resumeId, userId) {
  return Resume.findOne({ _id: resumeId, user: userId }).select(
    `${RESUME_META} +data`
  );
}

// Adds a new resume for the user. Multiple resumes per user are allowed.
async function createResume(userId, file) {
  const resume = await Resume.create({
    user: userId,
    originalName: file.originalName,
    contentType: file.contentType,
    size: file.size,
    data: file.data,
  });
  return findResumeMetaById(resume._id, userId);
}

// Swaps the file in place for one of the user's existing resumes. Returns
// null if it does not exist or belongs to someone else.
async function replaceResumeById(resumeId, userId, file) {
  await Resume.updateOne(
    { _id: resumeId, user: userId },
    {
      $set: {
        originalName: file.originalName,
        contentType: file.contentType,
        size: file.size,
        data: file.data,
      },
    }
  );
  return findResumeMetaById(resumeId, userId);
}

// Removes one of the user's resumes. Returns true if a resume was deleted,
// false if it did not exist or belonged to someone else.
async function deleteResumeById(resumeId, userId) {
  const result = await Resume.deleteOne({ _id: resumeId, user: userId });
  return result.deletedCount > 0;
}

module.exports = {
  listResumesByUser,
  findResumeMetaById,
  findResumeByIdForUser,
  createResume,
  replaceResumeById,
  deleteResumeById,
};
