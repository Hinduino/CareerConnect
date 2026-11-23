jest.mock("../middleware/auth", () => (req, res, next) => {
  req.user = { id: req.get("x-test-user-id") || "507f1f77bcf86cd799439011" };
  return next();
});
jest.mock("../middleware/requireRole", () => () => (req, res, next) => next());
jest.mock("../models/Application", () => ({
  findById: jest.fn(),
}));
jest.mock("../models/JobPosting", () => ({
  findById: jest.fn(),
}));
jest.mock("../models/User", () => ({
  findById: jest.fn(),
}));
jest.mock("../queries/applicationqueries", () => ({}));
jest.mock("../queries/notificationQueries", () => ({}));

const express = require("express");
const request = require("supertest");
const Application = require("../models/Application");
const JobPosting = require("../models/JobPosting");
const User = require("../models/User");
const applicationRoutes = require("./applicationRoutes");

const recruiterId = "507f1f77bcf86cd799439011";
const otherRecruiterId = "507f1f77bcf86cd799439099";
const applicantId = "507f1f77bcf86cd799439022";
const jobId = "507f1f77bcf86cd799439033";
const applicationId = "507f1f77bcf86cd799439044";

const job = {
  _id: jobId,
  title: "Software Engineer",
  company: "CareerConnect",
  postedBy: recruiterId,
};
const application = {
  _id: applicationId,
  applicant: applicantId,
  job: jobId,
  status: "Applied",
  createdAt: new Date("2026-11-13T12:00:00Z"),
  resume: {
    originalName: "jane-resume.pdf",
    contentType: "application/pdf",
    size: 1234,
  },
};
const applicant = {
  _id: applicantId,
  name: "Jane Doe",
  email: "jane@example.com",
  role: "job_seeker",
  location: "Montreal",
  bio: "Developer",
  password: "hashed-secret",
};

const app = express();
app.use(express.json());
app.use("/applications", applicationRoutes);

beforeEach(() => {
  jest.clearAllMocks();
  Application.findById.mockResolvedValue(application);
  JobPosting.findById.mockResolvedValue(job);
  User.findById.mockResolvedValue(applicant);
});

describe("GET /applications/:applicationId/applicant", () => {
  it("returns the applicant's profile and resume metadata to the owning recruiter", async () => {
    const res = await request(app)
      .get(`/applications/${applicationId}/applicant`)
      .set("x-test-user-id", recruiterId);

    expect(res.status).toBe(200);
    expect(res.body.applicant).toEqual({
      id: applicantId,
      name: "Jane Doe",
      email: "jane@example.com",
      role: "job_seeker",
      location: "Montreal",
      bio: "Developer",
      hasProfilePicture: false,
    });
    expect(res.body.applicant).not.toHaveProperty("password");
    expect(res.body.resume).toEqual({
      originalName: "jane-resume.pdf",
      contentType: "application/pdf",
      size: 1234,
    });
    expect(res.body.application).toMatchObject({
      _id: applicationId,
      status: "Applied",
      job: { _id: jobId, title: "Software Engineer", company: "CareerConnect" },
    });
  });

  it("returns a null resume when the application has none attached", async () => {
    Application.findById.mockResolvedValue({ ...application, resume: undefined });

    const res = await request(app)
      .get(`/applications/${applicationId}/applicant`)
      .set("x-test-user-id", recruiterId);

    expect(res.status).toBe(200);
    expect(res.body.resume).toBeNull();
  });

  it("rejects a malformed application id with 400", async () => {
    const res = await request(app)
      .get("/applications/not-an-id/applicant")
      .set("x-test-user-id", recruiterId);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid application ID");
  });

  it("returns 404 when the application does not exist", async () => {
    Application.findById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/applications/${applicationId}/applicant`)
      .set("x-test-user-id", recruiterId);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Application not found");
  });

  it("blocks a recruiter who does not own the job posting", async () => {
    const res = await request(app)
      .get(`/applications/${applicationId}/applicant`)
      .set("x-test-user-id", otherRecruiterId);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("You can only view applicants for your own job postings");
    expect(User.findById).not.toHaveBeenCalled();
  });

  it("blocks access when the job posting no longer exists", async () => {
    JobPosting.findById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/applications/${applicationId}/applicant`)
      .set("x-test-user-id", recruiterId);

    expect(res.status).toBe(403);
  });

  it("returns 404 when the applicant's account was deleted", async () => {
    User.findById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/applications/${applicationId}/applicant`)
      .set("x-test-user-id", recruiterId);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Applicant not found");
  });

  it("returns 500 when the lookup fails unexpectedly", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    Application.findById.mockRejectedValue(new Error("db down"));

    const res = await request(app)
      .get(`/applications/${applicationId}/applicant`)
      .set("x-test-user-id", recruiterId);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Server error fetching applicant profile");
    console.error.mockRestore();
  });
});
