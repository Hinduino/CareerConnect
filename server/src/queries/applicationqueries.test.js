jest.mock("../models/Application", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  deleteOne: jest.fn(),
}));
jest.mock("./resumeQueries", () => ({
  findResumeByIdForUser: jest.fn(),
}));

const Application = require("../models/Application");
const { findResumeByIdForUser } = require("./resumeQueries");
const { createApplication, cancelApplication, getApplicationStatus } = require("./applicationqueries");
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
      Application.findOne.mockResolvedValue({ _id: applicationId });
      Application.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await expect(cancelApplication(userId, applicationId)).resolves.toEqual({ _id: applicationId });
      expect(Application.findOne).toHaveBeenCalledWith({ _id: applicationId, applicant: userId });
      expect(Application.deleteOne).toHaveBeenCalledWith({ _id: applicationId });
    });

    it("rejects when the application doesn't exist or isn't owned by the user", async () => {
      Application.findOne.mockResolvedValue(null);

      await expect(cancelApplication(userId, applicationId)).rejects.toThrow("Application not found.");
      expect(Application.deleteOne).not.toHaveBeenCalled();
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
