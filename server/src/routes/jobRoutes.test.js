jest.mock("../middleware/auth", () => (req, res, next) => {
  req.user = { id: req.get("x-test-user-id") || "507f1f77bcf86cd799439011" };
  return next();
});
jest.mock("../middleware/requireRole", () => () => (req, res, next) => next());
jest.mock("../models/JobPosting", () => ({
  aggregate: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
}));
jest.mock("../queries/favoriteQueries", () => ({
  getFavoriteJobIds: jest.fn(),
  getFavoriteJobs: jest.fn(),
  toggleFavoriteJob: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const JobPosting = require("../models/JobPosting");
const {
  getFavoriteJobIds,
  getFavoriteJobs,
  toggleFavoriteJob,
} = require("../queries/favoriteQueries");
const jobRoutes = require("./jobRoutes");

const recruiterId = "507f1f77bcf86cd799439011";
const jobSeekerId = "507f1f77bcf86cd799439022";
const jobId = "507f1f77bcf86cd799439033";
const jobFields = {
  title: "Software Engineer",
  company: "Acme",
  location: "Remote",
  category: "Engineering",
  description: "Build things",
  requirements: "Experience required",
};

const app = express();
app.use(express.json());
app.use("/api/jobs", jobRoutes);

describe("job routes error handling", () => {
  let consoleError;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("returns a validation error for an invalid due date when creating a job", async () => {
    const response = await request(app)
      .post("/api/jobs")
      .set("x-test-user-id", recruiterId)
      .send({ ...jobFields, dueDate: "not-a-date" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("dueDate must be a valid date");
    expect(JobPosting.create).not.toHaveBeenCalled();
  });

  it("returns a validation error for an invalid due date when updating a job", async () => {
    JobPosting.findById.mockResolvedValue({
      postedBy: { toString: () => recruiterId },
    });

    const response = await request(app)
      .put(`/api/jobs/${jobId}`)
      .set("x-test-user-id", recruiterId)
      .send({ ...jobFields, dueDate: "not-a-date" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("dueDate must be a valid date");
  });

  it("returns server errors when favorite job queries fail", async () => {
    getFavoriteJobs.mockRejectedValue(new Error("database unavailable"));
    getFavoriteJobIds.mockRejectedValue(new Error("database unavailable"));

    const favoritesResponse = await request(app)
      .get("/api/jobs/favorites")
      .set("x-test-user-id", jobSeekerId);
    const idsResponse = await request(app)
      .get("/api/jobs/favorites/ids")
      .set("x-test-user-id", jobSeekerId);

    expect(favoritesResponse.status).toBe(500);
    expect(favoritesResponse.body.error).toBe("Server error fetching favorite jobs");
    expect(idsResponse.status).toBe(500);
    expect(idsResponse.body.error).toBe("Server error fetching favorite job IDs");
  });

  it("returns favorite job IDs for the signed-in job seeker", async () => {
    getFavoriteJobIds.mockResolvedValue([jobId]);

    const response = await request(app)
      .get("/api/jobs/favorites/ids")
      .set("x-test-user-id", jobSeekerId);

    expect(response.status).toBe(200);
    expect(response.body.favoriteIds).toEqual([jobId]);
    expect(getFavoriteJobIds).toHaveBeenCalledWith(jobSeekerId);
  });

  it("maps missing favorites to not found and reports unexpected toggle errors", async () => {
    toggleFavoriteJob.mockRejectedValueOnce(new Error("Job not found."));
    toggleFavoriteJob.mockRejectedValueOnce(new Error("database unavailable"));

    const missingResponse = await request(app)
      .post(`/api/jobs/${jobId}/favorite`)
      .set("x-test-user-id", jobSeekerId);
    const errorResponse = await request(app)
      .post(`/api/jobs/${jobId}/favorite`)
      .set("x-test-user-id", jobSeekerId);

    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body.error).toBe("Job not found.");
    expect(errorResponse.status).toBe(500);
    expect(errorResponse.body.error).toBe("Server error toggling favorite job");
  });

  it("reports both favorite toggle outcomes", async () => {
    toggleFavoriteJob
      .mockResolvedValueOnce({ favorited: true, savedJobIds: [jobId] })
      .mockResolvedValueOnce({ favorited: false, savedJobIds: [] });

    const addedResponse = await request(app)
      .post(`/api/jobs/${jobId}/favorite`)
      .set("x-test-user-id", jobSeekerId);
    const removedResponse = await request(app)
      .post(`/api/jobs/${jobId}/favorite`)
      .set("x-test-user-id", jobSeekerId);

    expect(addedResponse.body.message).toBe("Job added to favorites");
    expect(removedResponse.body.message).toBe("Job removed from favorites");
  });

  it("returns a server error when recruiter posting aggregation fails", async () => {
    JobPosting.aggregate.mockRejectedValue(new Error("database unavailable"));

    const response = await request(app)
      .get("/api/jobs/mine")
      .set("x-test-user-id", recruiterId);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Server error fetching your job postings");
  });

  it("returns server errors when listing or fetching a job fails", async () => {
    JobPosting.find.mockReturnValue({
      sort: jest.fn().mockRejectedValue(new Error("database unavailable")),
    });
    JobPosting.findById.mockRejectedValue(new Error("database unavailable"));

    const listResponse = await request(app).get("/api/jobs");
    const detailResponse = await request(app).get(`/api/jobs/${jobId}`);

    expect(listResponse.status).toBe(500);
    expect(listResponse.body.error).toBe("Server error fetching jobs");
    expect(detailResponse.status).toBe(500);
    expect(detailResponse.body.error).toBe("Server error fetching job details");
  });

  it("returns a job when its detail is requested", async () => {
    const job = { _id: jobId, ...jobFields };
    JobPosting.findById.mockResolvedValue(job);

    const response = await request(app).get(`/api/jobs/${jobId}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject(job);
  });

  it("returns a server error when job creation fails", async () => {
    JobPosting.create.mockRejectedValue(new Error("database unavailable"));

    const response = await request(app)
      .post("/api/jobs")
      .set("x-test-user-id", recruiterId)
      .send(jobFields);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Server error creating job posting");
  });

  it("creates a job with a valid due date", async () => {
    const createdJob = { _id: jobId, ...jobFields };
    JobPosting.create.mockResolvedValue(createdJob);

    const response = await request(app)
      .post("/api/jobs")
      .set("x-test-user-id", recruiterId)
      .send({ ...jobFields, dueDate: "2027-01-15T00:00:00.000Z" });

    expect(response.status).toBe(201);
    expect(JobPosting.create).toHaveBeenCalledWith(
      expect.objectContaining({ dueDate: new Date("2027-01-15T00:00:00.000Z") })
    );
  });

  it("returns a server error when saving an archive toggle fails", async () => {
    JobPosting.findById.mockResolvedValue({
      postedBy: { toString: () => recruiterId },
      save: jest.fn().mockRejectedValue(new Error("database unavailable")),
    });

    const response = await request(app)
      .patch(`/api/jobs/${jobId}/archive`)
      .set("x-test-user-id", recruiterId);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Server error toggling archive status");
  });

  it("returns a server error when saving an updated job fails", async () => {
    JobPosting.findById.mockResolvedValue({
      postedBy: { toString: () => recruiterId },
      save: jest.fn().mockRejectedValue(new Error("database unavailable")),
    });

    const response = await request(app)
      .put(`/api/jobs/${jobId}`)
      .set("x-test-user-id", recruiterId)
      .send(jobFields);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Server error updating job posting");
  });

  it("updates a job's due date when the field is provided", async () => {
    const job = {
      postedBy: { toString: () => recruiterId },
      save: jest.fn().mockResolvedValue(undefined),
    };
    JobPosting.findById.mockResolvedValue(job);

    const response = await request(app)
      .put(`/api/jobs/${jobId}`)
      .set("x-test-user-id", recruiterId)
      .send({ ...jobFields, dueDate: "2027-01-15T00:00:00.000Z" });

    expect(response.status).toBe(200);
    expect(job.dueDate).toEqual(new Date("2027-01-15T00:00:00.000Z"));
    expect(job.save).toHaveBeenCalled();
  });

  it("clears a job's due date when an empty value is provided", async () => {
    const job = {
      postedBy: { toString: () => recruiterId },
      dueDate: new Date("2027-01-15T00:00:00.000Z"),
      save: jest.fn().mockResolvedValue(undefined),
    };
    JobPosting.findById.mockResolvedValue(job);

    const response = await request(app)
      .put(`/api/jobs/${jobId}`)
      .set("x-test-user-id", recruiterId)
      .send({ ...jobFields, dueDate: "" });

    expect(response.status).toBe(200);
    expect(job.dueDate).toBeNull();
  });

  it("returns a server error when deleting a job fails", async () => {
    JobPosting.findById.mockResolvedValue({
      postedBy: { toString: () => recruiterId },
      deleteOne: jest.fn().mockRejectedValue(new Error("database unavailable")),
    });

    const response = await request(app)
      .delete(`/api/jobs/${jobId}`)
      .set("x-test-user-id", recruiterId);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Server error deleting job posting");
  });
});
