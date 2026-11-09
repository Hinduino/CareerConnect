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

//SCRUM-309: Candidate cancels / withdraws an active application.
// Note: Instead of deleteOne, we update the status to "Cancelled" so the application
// record is preserved for history and audit tracking, and records cancelledAt.
 
async function cancelApplication(userId, applicationId) {
  const application = await Application.findOne({ _id: applicationId, applicant: userId });
  if (!application) {
    throw new Error("Application not found.");
  }

  // Prevent cancelling already finalized or inactive applications
  if (["Rejected", "Offer Declined", "Cancelled"].includes(application.status)) {
    throw new Error("Application is already finalized or cancelled.");
  }
  application.status = "Cancelled";
  application.cancelledAt = new Date();
  await application.save();
  return application;
}


// SCRUM-309: Candidate declines an extended job offer.
// Changes status from 'Offered' to 'Offer Declined' and records the timestamp.
// This guarantees the rejection is recorded as candidate-initiated, not recruiter-rejected.

async function declineJobOffer(applicationId, userId) {
  const application = await Application.findOne({ _id: applicationId, applicant: userId });
  if (!application) {
    throw new Error("Application not found.");
  }

  if (application.status !== "Offered") {
    throw new Error("Cannot decline an offer unless one has been extended.");
  }

  application.status = "Offer Declined";
  application.declinedAt = new Date();
  await application.save();

  return application;
}

// SCRUM-309: Retrieve full application history for the applicant.
// Returns records sorted newest first (createdAt: -1) and populates
// the job details needed by the History Table (title, company, location, description).

async function getApplicationHistoryByUser(userId) {
  return Application.find({ applicant: userId })
    .populate("job", "title company location category description requirements")
    .sort({ createdAt: -1 });
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

// Retrieve all applications submitted by the logged-in job seeker.
async function getMyApplications(userId) {
  return Application.find({ applicant: userId })
    .select("_id job status createdAt updatedAt")
    .populate("job", "title company location category")
    .sort({ createdAt: -1 });
}
// Update an application status only if the recruiter owns the job.
async function updateApplicationStatus(recruiterId, applicationId, status) {
  const allowedStatuses = [
    "Applied",
    "Under Review",
    "Interview",
    "Offered",
    "Rejected",
    "Offer Declined",
  ];

  if (!allowedStatuses.includes(status)) {
    throw new Error("Invalid application status.");
  }

  const application = await Application.findById(applicationId);

  if (!application) {
    throw new Error("Application not found.");
  }

  const JobPosting = require("../models/JobPosting");
  const job = await JobPosting.findById(application.job);

  if (!job || job.postedBy.toString() !== recruiterId) {
    throw new Error("Not authorized to update this application.");
  }

  application.status = status;
  await application.save();

  return application;
}
module.exports = {
  createApplication,
  cancelApplication,
  declineJobOffer,
  getApplicationHistoryByUser,
  getApplicationStatus,
  getMyApplications,
  updateApplicationStatus,
};
