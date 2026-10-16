const Application = require("../models/application");

// Creates a new job application in the database
async function createApplication(userId, jobId) {
  // Check if the user has already applied to this specific job
  const existingApplication = await Application.findOne({ applicant: userId, job: jobId });
  if (existingApplication) {
    throw new Error("You have already applied for this job.");
  }

  const newApplication = await Application.create({
    applicant: userId,
    job: jobId,
    status: "Applied"
  });
  
  return newApplication;
}

module.exports = {
  createApplication,
};