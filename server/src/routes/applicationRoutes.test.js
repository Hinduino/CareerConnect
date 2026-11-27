jest.mock("../middleware/auth", () => (req, res, next) => {
  req.user = { id: req.get("x-test-user-id") || "507f1f77bcf86cd799439011" };
  return next();
});
jest.mock("../middleware/requireRole", () => () => (req, res, next) => next());
jest.mock("../models/Application", () => ({
  findOne: jest.fn(),
}));
jest.mock("../models/JobPosting", () => ({
  findById: jest.fn(),
}));
jest.mock("../queries/applicationqueries", () => ({
  cancelApplication: jest.fn(),
  createApplication: jest.fn(),
  declineJobOffer: jest.fn(),
  updateApplicationStatus: jest.fn(),
}));
jest.mock("../queries/notificationQueries", () => ({
  createNotification: jest.fn(),
  createNotificationSafe: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const Application = require("../models/Application");
const JobPosting = require("../models/JobPosting");
const {
  cancelApplication,
  createApplication,
  declineJobOffer,
  updateApplicationStatus,
} = require("../queries/applicationqueries");
const { createNotificationSafe } = require("../queries/notificationQueries");
const { APPLICATION_STATUSES } = require("../constants/applicationStatus");
const applicationRoutes = require("./applicationRoutes");

const recruiterId = "507f1f77bcf86cd799439011";
const applicantId = "507f1f77bcf86cd799439022";
const jobId = "507f1f77bcf86cd799439033";
const applicationId = "507f1f77bcf86cd799439044";
const resumeId = "507f1f77bcf86cd799439055";
const job = { _id: jobId, title: "Software Engineer", company: "CareerConnect" };
const application = { _id: applicationId, applicant: applicantId, job: jobId };

const app = express();
app.use(express.json());
app.use("/applications", applicationRoutes);

describe("application route notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createNotificationSafe.mockResolvedValue(null);
    JobPosting.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(job),
    });
  });

  it("notifies the job's recruiter when an application is submitted", async () => {
    const submittedApplication = {
      ...application,
      status: APPLICATION_STATUSES.APPLIED,
      createdAt: new Date("2026-11-13T12:00:00Z"),
    };
    JobPosting.findById.mockResolvedValue({ ...job, postedBy: recruiterId });
    createApplication.mockResolvedValue(submittedApplication);

    const response = await request(app)
      .post("/applications")
      .set("x-test-user-id", applicantId)
      .send({ jobId, resumeId });

    expect(response.status).toBe(201);
    expect(createNotificationSafe).toHaveBeenCalledWith({
      recipient: recruiterId,
      type: "APPLICATION_SUBMITTED",
      title: "New Application Received",
      message: `A candidate applied for "${job.title}" at ${job.company}.`,
      relatedJob: jobId,
      relatedApplication: applicationId,
    });
  });

  it("returns a generic error when application submission fails", async () => {
    JobPosting.findById.mockResolvedValue({
      ...job,
      postedBy: recruiterId,
    });

    createApplication.mockRejectedValueOnce(
      new Error("Internal database connection failed")
    );

    const response = await request(app)
      .post("/applications")
      .set("x-test-user-id", applicantId)
      .send({ jobId, resumeId });

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      error: "Server error submitting application.",
    });

    expect(createNotificationSafe).not.toHaveBeenCalled();
  });

  it("returns 409 when MongoDB rejects a duplicate application", async () => {
    JobPosting.findById.mockResolvedValue({
      ...job,
      postedBy: recruiterId,
    });

    const duplicateError = new Error("Duplicate key error");
    duplicateError.code = 11000;

    createApplication.mockRejectedValueOnce(duplicateError);

    const response = await request(app)
      .post("/applications")
      .set("x-test-user-id", applicantId)
      .send({ jobId, resumeId });

    expect(response.status).toBe(409);

    expect(response.body).toEqual({
      error: "You have already applied for this job.",
    });

    expect(createNotificationSafe).not.toHaveBeenCalled();
  });

  it("returns a generic error when declining an offer fails", async () => {
    declineJobOffer.mockRejectedValueOnce(
      new Error("Internal database connection failed")
    );

    const response = await request(app)
      .patch(`/applications/${applicationId}/decline-offer`)
      .set("x-test-user-id", applicantId);

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      error: "Server error declining offer.",
    });

    expect(createNotificationSafe).not.toHaveBeenCalled();
  });

  it("notifies the recruiter when an applicant declines an offer", async () => {
    const declinedApplication = {
      ...application,
      status: APPLICATION_STATUSES.OFFER_DECLINED,
    };
    JobPosting.findById.mockResolvedValue({ ...job, postedBy: recruiterId });
    declineJobOffer.mockResolvedValue(declinedApplication);

    const response = await request(app)
      .patch(`/applications/${applicationId}/decline-offer`)
      .set("x-test-user-id", applicantId);

    expect(response.status).toBe(200);
    expect(createNotificationSafe).toHaveBeenCalledWith({
      recipient: recruiterId,
      type: "APPLICATION_STATUS",
      title: "Job Offer Declined",
      message: `A candidate declined the offer for "${job.title}" at ${job.company}.`,
      relatedJob: jobId,
      relatedApplication: applicationId,
    });
  });

  it("notifies the recruiter when an applicant withdraws an application", async () => {
    Application.findOne.mockResolvedValue(application);
    cancelApplication.mockResolvedValue(undefined);
    JobPosting.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ ...job, postedBy: recruiterId }),
    });

    const response = await request(app)
      .delete(`/applications/${applicationId}`)
      .set("x-test-user-id", applicantId);

    expect(response.status).toBe(200);
    expect(createNotificationSafe).toHaveBeenCalledWith({
      recipient: recruiterId,
      type: "APPLICATION_WITHDRAWN",
      title: "Application Withdrawn",
      message: `A candidate withdrew their application for "${job.title}" at ${job.company}.`,
      relatedJob: jobId,
      relatedApplication: applicationId,
    });
  });

  it("notifies the applicant when their application status changes", async () => {
    const status = APPLICATION_STATUSES.UNDER_REVIEW;
    updateApplicationStatus.mockResolvedValue({ ...application, status });

    const response = await request(app)
      .patch(`/applications/${applicationId}/status`)
      .send({ status });

    expect(response.status).toBe(200);
    expect(createNotificationSafe).toHaveBeenCalledWith({
      recipient: applicantId,
      type: "APPLICATION_STATUS",
      title: `Application Status Updated: ${status}`,
      message: `Your application for "${job.title}" at ${job.company} is now "${status}".`,
      relatedJob: jobId,
      relatedApplication: applicationId,
    });
  });

  it("notifies the applicant with a dedicated Interview Invitation when status becomes Interview", async () => {
    const status = APPLICATION_STATUSES.INTERVIEW;
    updateApplicationStatus.mockResolvedValue({ ...application, status });

    const response = await request(app)
      .patch(`/applications/${applicationId}/status`)
      .send({ status });

    expect(response.status).toBe(200);
    expect(createNotificationSafe).toHaveBeenCalledWith({
      recipient: applicantId,
      type: "INTERVIEW_INVITATION",
      title: "Interview Invitation",
      message: `You have been invited to an interview for "${job.title}" at ${job.company}!`,
      relatedJob: jobId,
      relatedApplication: applicationId,
    });
  });

  it("notifies the applicant when they receive an offer", async () => {
    const status = APPLICATION_STATUSES.OFFERED;
    updateApplicationStatus.mockResolvedValue({ ...application, status });

    const response = await request(app)
      .patch(`/applications/${applicationId}/status`)
      .send({ status });

    expect(response.status).toBe(200);
    expect(createNotificationSafe).toHaveBeenCalledWith({
      recipient: applicantId,
      type: "APPLICATION_STATUS",
      title: `Application Status Updated: ${status}`,
      message: `Your application for "${job.title}" at ${job.company} is now "${status}".`,
      relatedJob: jobId,
      relatedApplication: applicationId,
    });
  });
});