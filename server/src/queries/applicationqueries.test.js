jest.mock("../models/Application", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndDelete: jest.fn(),
  create: jest.fn(),
  deleteOne: jest.fn(),
}));
jest.mock("./resumeQueries", () => ({
  findResumeByIdForUser: jest.fn(),
}));

const Application = require("../models/Application");
const { findResumeByIdForUser } = require("./resumeQueries");
const mongoose = require("mongoose");

const {
  createApplication,
  cancelApplication,
  getApplicationStatus,
  getApplicationHistoryByUser,
} = require("./applicationqueries");
const { APPLICATION_STATUSES } = require("../constants/applicationStatus");

const userId = "507f1f77bcf86cd799439011";
const jobId = "507f1f77bcf86cd799439033";
const resumeId = "507f1f77bcf86cd799439022";
const applicationId = "507f1f77bcf86cd799439044";
const resume = {
  originalName: "resume.pdf",
  contentType: "application/pdf",
  size: 4,
  data: Buffer.from("test"),
};

describe("applicationqueries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createApplication", () => {
    it("rejects when no resume is selected", async () => {
      await expect(createApplication(userId, jobId, undefined)).rejects.toThrow(
        "Please select a resume to apply with."
      );
      expect(Application.findOne).not.toHaveBeenCalled();
    });

    it("rejects a duplicate application for the same job", async () => {
      Application.findOne.mockResolvedValue({ _id: "existing" });

      await expect(createApplication(userId, jobId, resumeId)).rejects.toThrow(
        "You have already applied for this job."
      );
      expect(findResumeByIdForUser).not.toHaveBeenCalled();
    });

    it("rejects when the selected resume can't be found for this user", async () => {
      Application.findOne.mockResolvedValue(null);
      findResumeByIdForUser.mockResolvedValue(null);

      await expect(createApplication(userId, jobId, resumeId)).rejects.toThrow(
        "Selected resume could not be found."
      );
      expect(Application.create).not.toHaveBeenCalled();
    });

    it("creates an application with a snapshot of the selected resume", async () => {
      Application.findOne.mockResolvedValue(null);
      findResumeByIdForUser.mockResolvedValue(resume);
      Application.create.mockResolvedValue({ _id: applicationId });

      await expect(createApplication(userId, jobId, resumeId)).resolves.toEqual({ _id: applicationId });
      expect(Application.create).toHaveBeenCalledWith({
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
    });
  });

  describe("cancelApplication", () => {
  it("deletes an application owned by the requesting user", async () => {
    Application.findOneAndDelete.mockResolvedValue({
      _id: applicationId
    });

    await expect(cancelApplication(userId, applicationId))
      .resolves.toEqual({ _id: applicationId });

    expect(Application.findOneAndDelete).toHaveBeenCalledWith({
      _id: new mongoose.Types.ObjectId(applicationId),
      applicant: new mongoose.Types.ObjectId(userId)
    });
  });

  it("rejects when the application doesn't exist or isn't owned by the user", async () => {
    Application.findOneAndDelete.mockResolvedValue(null);

    await expect(cancelApplication(userId, applicationId))
      .rejects.toThrow("Application not found.");

    expect(Application.findOneAndDelete).toHaveBeenCalledWith({
      _id: new mongoose.Types.ObjectId(applicationId),
      applicant: new mongoose.Types.ObjectId(userId)
    });
  });

  it("rejects an invalid application identifier", async () => {
    await expect(cancelApplication(userId, "invalid-id"))
      .rejects.toThrow("Invalid identifier.");

    expect(Application.findOneAndDelete).not.toHaveBeenCalled();
  });

  it("rejects an invalid user identifier", async () => {
    await expect(cancelApplication("invalid-id", applicationId))
      .rejects.toThrow("Invalid identifier.");

    expect(Application.findOneAndDelete).not.toHaveBeenCalled();
  });

  it("rejects non-string application identifiers", async () => {
    await expect(cancelApplication(userId, {}))
      .rejects.toThrow("Invalid identifier.");

    expect(Application.findOneAndDelete).not.toHaveBeenCalled();
  });
});
  describe("getApplicationHistoryByUser", () => {
  it("retrieves application history using a validated user identifier", async () => {
    const applications = [{ _id: applicationId }];

    const sort = jest.fn().mockResolvedValue(applications);
    const populate = jest.fn().mockReturnValue({ sort });

    Application.find.mockReturnValue({ populate });

    await expect(getApplicationHistoryByUser(userId))
      .resolves.toEqual(applications);

    expect(Application.find).toHaveBeenCalledWith({
      applicant: new mongoose.Types.ObjectId(userId)
    });

    expect(populate).toHaveBeenCalledWith(
      "job",
      "title company location category description requirements"
    );

    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it("rejects an invalid user identifier", async () => {
    await expect(getApplicationHistoryByUser("invalid-id"))
      .rejects.toThrow("Invalid identifier.");

    expect(Application.find).not.toHaveBeenCalled();
  });

  it("rejects non-string user identifiers", async () => {
    await expect(getApplicationHistoryByUser({}))
      .rejects.toThrow("Invalid identifier.");

    expect(Application.find).not.toHaveBeenCalled();
  });
});
  describe("getApplicationStatus", () => {
    it("reports an existing application", async () => {
      const select = jest.fn().mockResolvedValue({ _id: applicationId, status: APPLICATION_STATUSES.APPLIED });
      Application.findOne.mockReturnValue({ select });

      await expect(getApplicationStatus(userId, jobId)).resolves.toEqual({
        applied: true,
        applicationId,
      });
      expect(Application.findOne).toHaveBeenCalledWith({ applicant: userId, job: jobId });
    });

    it("reports no application on file", async () => {
      const select = jest.fn().mockResolvedValue(null);
      Application.findOne.mockReturnValue({ select });

      await expect(getApplicationStatus(userId, jobId)).resolves.toEqual({
        applied: false,
        applicationId: null,
      });
    });
  });
});
