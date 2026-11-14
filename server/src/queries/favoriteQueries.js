const User = require("../models/User");
const JobPosting = require("../models/JobPosting");

async function toggleFavoriteJob(userId, jobId) {
  const job = await JobPosting.findById(jobId).select("_id");
  if (!job) {
    throw new Error("Job not found.");
  }

  const user = await User.findById(userId).select("savedJobs");
  if (!user) {
    throw new Error("User not found.");
  }

  const currentSaved = Array.isArray(user.savedJobs) ? user.savedJobs : [];
  const isAlreadySaved = currentSaved.some(
    (savedId) => savedId.toString() === jobId.toString()
  );

  const updateOperator = isAlreadySaved
    ? { $pull: { savedJobs: jobId } }
    : { $addToSet: { savedJobs: jobId } };

  const updatedUser = await User.findByIdAndUpdate(userId, updateOperator, {
    new: true,
  }).select("savedJobs");

  return {
    favorited: !isAlreadySaved,
    savedJobIds: (updatedUser?.savedJobs || []).map((id) => id.toString()),
  };
}

async function getFavoriteJobIds(userId) {
  const user = await User.findById(userId).select("savedJobs");
  if (!user) {
    throw new Error("User not found.");
  }
  return (user.savedJobs || []).map((id) => id.toString());
}

async function getFavoriteJobs(userId) {
  const user = await User.findById(userId)
    .select("savedJobs")
    .populate({
      path: "savedJobs",
      select: "title company location category description requirements isArchived createdAt",
    });

  if (!user) {
    throw new Error("User not found.");
  }

  return (user.savedJobs || []).filter(Boolean);
}

module.exports = {
  toggleFavoriteJob,
  getFavoriteJobIds,
  getFavoriteJobs,
};