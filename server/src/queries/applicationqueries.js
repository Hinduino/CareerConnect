const Application = require("../models/Application");
const { findResumeByIdForUser } = require("./resumeQueries");

// Creates a new job application in the database, attaching a snapshot of
// one of the applicant's saved resumes.
async function createApplication(userId, jobId, resumeId) {
  if (!resumeId) {
    throw new Error("Please select a resume to apply with.");
  }

  // Check if the user has already applied to this specific job
  const existingApplication = await Application.findOne({ applicant: userId, job: jobId });
  if (existingApplication) {
    throw new Error("You have already applied for this job.");
  }

  const resume = await findResumeByIdForUser(resumeId, userId);
  if (!resume) {
    throw new Error("Selected resume could not be found.");
  }

  const newApplication = await Application.create({
    applicant: userId,
    job: jobId,
    status: "Applied",
    resume: {
      originalName: resume.originalName,
      contentType: resume.contentType,
      size: resume.size,
      data: resume.data,
    },
  });

  return newApplication;
}

// Lets an applicant cancel (delete) one of their own applications. Deleting
// it - rather than marking it withdrawn - removes it from the recruiter's
// applicant list and immediately frees the applicant to apply again.
async function cancelApplication(userId, applicationId) {
  const application = await Application.findOne({ _id: applicationId, applicant: userId });
  if (!application) {
    throw new Error("Application not found.");
  }

  await Application.deleteOne({ _id: applicationId });
  return application;
}

// Whether the given user currently has an application on file for a job.
async function getApplicationStatus(userId, jobId) {
  const application = await Application.findOne({ applicant: userId, job: jobId }).select(
    "_id status"
  );
  return {
    applied: Boolean(application),
    applicationId: application ? application._id : null,
  };
}

module.exports = {
  createApplication,
  cancelApplication,
  getApplicationStatus,
};
