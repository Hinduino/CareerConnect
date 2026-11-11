const Application = require("../models/Application");
const { APPLICATION_STATUSES } = require("../constants/applicationStatus");
const { findResumeByIdForUser } = require("./resumeQueries");

const RECRUITER_EDITABLE_STATUSES = [
  APPLICATION_STATUSES.APPLIED,
  APPLICATION_STATUSES.UNDER_REVIEW,
  APPLICATION_STATUSES.INTERVIEW,
  APPLICATION_STATUSES.OFFERED,
  APPLICATION_STATUSES.REJECTED,
];

async function createApplication(userId, jobId, resumeId) {
  if (!resumeId) {
    throw new Error("Please select a resume to apply with.");
  }

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
    status: APPLICATION_STATUSES.APPLIED,
    resume: {
      originalName: resume.originalName,
      contentType: resume.contentType,
      size: resume.size,
      data: resume.data,
    },
  });

  return newApplication;
}

async function cancelApplication(userId, applicationId) {
  const application = await Application.findOne({ _id: applicationId, applicant: userId });
  if (!application) {
    throw new Error("Application not found.");
  }

  await Application.deleteOne({ _id: applicationId });
  return application;
}

async function declineJobOffer(applicationId, userId) {
  const application = await Application.findOne({ _id: applicationId, applicant: userId });
  if (!application) {
    throw new Error("Application not found.");
  }

  if (application.status !== APPLICATION_STATUSES.OFFERED) {
    throw new Error("Cannot decline an offer unless one has been extended.");
  }

  application.status = APPLICATION_STATUSES.OFFER_DECLINED;
  application.declinedAt = new Date();
  await application.save();

  return application;
}

async function getApplicationHistoryByUser(userId) {
  return Application.find({ applicant: userId })
    .populate("job", "title company location category description requirements")
    .sort({ createdAt: -1 });
}

async function getApplicationStatus(userId, jobId) {
  const application = await Application.findOne({ applicant: userId, job: jobId }).select(
    "_id status"
  );
  return {
    applied: Boolean(application),
    applicationId: application ? application._id : null,
  };
}

async function getMyApplications(userId) {
  return Application.find({ applicant: userId })
    .select("_id job status createdAt updatedAt")
    .populate("job", "title company location category")
    .sort({ createdAt: -1 });
}

async function updateApplicationStatus(recruiterId, applicationId, status) {
  if (!RECRUITER_EDITABLE_STATUSES.includes(status)) {
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
