const Resume = require("../models/Resume");

async function findResumeByUser(userId) {
  return await Resume.findOne({ user: userId });
}

async function findResumeMetaByUser(userId) {
  return await Resume.findOne({ user: userId }).select("-data");
}

async function createResume(data) {
  return await Resume.create(data);
}

async function replaceResume(userId, data) {
  return await Resume.findOneAndUpdate(
    { user: userId },
    { user: userId, ...data },
    { new: true, upsert: true, runValidators: true }
  );
}

async function deleteResumeByUser(userId) {
  return await Resume.findOneAndDelete({ user: userId });
}

module.exports = {
  findResumeByUser,
  findResumeMetaByUser,
  createResume,
  replaceResume,
  deleteResumeByUser,
};