// SCRUM-278: Unit tests for the SCRUM-106 query functions added in
// PR #50 (updateApplicationStatus, getMyApplications) and
// PR #51 (declineJobOffer, getApplicationHistoryByUser).
// The database models are mocked, so these run without MongoDB.

jest.mock("../models/Application", () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
}));
jest.mock("../models/JobPosting", () => ({
  findById: jest.fn(),
}));
jest.mock("./resumeQueries", () => ({
  findResumeByIdForUser: jest.fn(),
}));

const Application = require("../models/Application");
const JobPosting = require("../models/JobPosting");
const { APPLICATION_STATUSES } = require("../constants/applicationStatus");
const {
  updateApplicationStatus,
  declineJobOffer,
  getMyApplications,
  getApplicationHistoryByUser,
} = require("./applicationqueries");

const recruiterId = "507f1f77bcf86cd799439011";
const otherRecruiterId = "507f1f77bcf86cd799439012";
const applicantId = "507f1f77bcf86cd799439022";
const jobId = "507f1f77bcf86cd799439033";
const applicationId = "507f1f77bcf86cd799439044";

function fakeApplication(status) {
  return {
    _id: applicationId,
    job: jobId,
    applicant: applicantId,
    status,
    declinedAt: null,
    save: jest.fn().mockResolvedValue(undefined),
  };
}

// Mimics Mongoose's chainable query: find().select().populate().sort()
function chainableQuery(result) {
  const query = {
    select: jest.fn(() => query),
    populate: jest.fn(() => query),
    sort: jest.fn(() => Promise.resolve(result)),
  };
  return query;
}

describe("SCRUM-106 application queries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("updateApplicationStatus (PR #50)", () => {
    it.each([APPLICATION_STATUSES.APPLIED, APPLICATION_STATUSES.UNDER_REVIEW, APPLICATION_STATUSES.INTERVIEW, APPLICATION_STATUSES.OFFERED, APPLICATION_STATUSES.REJECTED])(
      "lets the owning recruiter set \"%s\"",
      async (status) => {
        const application = fakeApplication(APPLICATION_STATUSES.APPLIED);
        Application.findById.mockResolvedValue(application);
        JobPosting.findById.mockResolvedValue({ postedBy: recruiterId });

        const result = await updateApplicationStatus(recruiterId, applicationId, status);

        expect(result.status).toBe(status);
        expect(application.save).toHaveBeenCalledTimes(1);
        expect(JobPosting.findById).toHaveBeenCalledWith(jobId);
      }
    );

    it.each(["Hired", "interview", "", undefined, null])(
      "rejects the invalid status %p before touching the database",
      async (status) => {
        await expect(updateApplicationStatus(recruiterId, applicationId, status)).rejects.toThrow(
          "Invalid application status."
        );
        expect(Application.findById).not.toHaveBeenCalled();
      }
    );

    it("rejects 'Cancelled', which only the system should set", async () => {
      await expect(updateApplicationStatus(recruiterId, applicationId, APPLICATION_STATUSES.CANCELLED)).rejects.toThrow(
        "Invalid application status."
      );
    });

    it("throws when the application does not exist", async () => {
      Application.findById.mockResolvedValue(null);

      await expect(updateApplicationStatus(recruiterId, applicationId, APPLICATION_STATUSES.INTERVIEW)).rejects.toThrow(
        "Application not found."
      );
    });

    it("refuses a recruiter who does not own the job, without saving", async () => {
      const application = fakeApplication(APPLICATION_STATUSES.APPLIED);
      Application.findById.mockResolvedValue(application);
      JobPosting.findById.mockResolvedValue({ postedBy: otherRecruiterId });

      await expect(updateApplicationStatus(recruiterId, applicationId, APPLICATION_STATUSES.REJECTED)).rejects.toThrow(
        "Not authorized to update this application."
      );
      expect(application.status).toBe(APPLICATION_STATUSES.APPLIED);
      expect(application.save).not.toHaveBeenCalled();
    });

    it("refuses when the job posting has been deleted", async () => {
      Application.findById.mockResolvedValue(fakeApplication(APPLICATION_STATUSES.APPLIED));
      JobPosting.findById.mockResolvedValue(null);

      await expect(updateApplicationStatus(recruiterId, applicationId, APPLICATION_STATUSES.INTERVIEW)).rejects.toThrow(
        "Not authorized to update this application."
      );
    });

    // Known bug: "Offer Declined" should only come from the candidate (PR #51).
    it("rejects 'Offer Declined' from a recruiter (only candidate can set this)", async () => {
      Application.findById.mockResolvedValue(fakeApplication(APPLICATION_STATUSES.OFFERED));
      JobPosting.findById.mockResolvedValue({ postedBy: recruiterId });

      await expect(
        updateApplicationStatus(recruiterId, applicationId, APPLICATION_STATUSES.OFFER_DECLINED)
      ).rejects.toThrow("Invalid application status.");
    });
  });

  describe("declineJobOffer (PR #51)", () => {
    it("changes Offered to 'Offer Declined', records the time, and saves", async () => {
      const application = fakeApplication(APPLICATION_STATUSES.OFFERED);
      Application.findOne.mockResolvedValue(application);

      const before = Date.now();
      const result = await declineJobOffer(applicationId, applicantId);

      expect(Application.findOne).toHaveBeenCalledWith({ _id: applicationId, applicant: applicantId });
      expect(result.status).toBe(APPLICATION_STATUSES.OFFER_DECLINED);
      expect(result.declinedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(application.save).toHaveBeenCalledTimes(1);
    });

    it.each([APPLICATION_STATUSES.APPLIED, APPLICATION_STATUSES.UNDER_REVIEW, APPLICATION_STATUSES.INTERVIEW, APPLICATION_STATUSES.REJECTED, APPLICATION_STATUSES.OFFER_DECLINED])(
      "refuses when the status is \"%s\", without saving",
      async (status) => {
        const application = fakeApplication(status);
        Application.findOne.mockResolvedValue(application);

        await expect(declineJobOffer(applicationId, applicantId)).rejects.toThrow(
          "Cannot decline an offer unless one has been extended."
        );
        expect(application.status).toBe(status);
        expect(application.save).not.toHaveBeenCalled();
      }
    );

    it("throws when the application isn't found for this applicant", async () => {
      Application.findOne.mockResolvedValue(null);

      await expect(declineJobOffer(applicationId, applicantId)).rejects.toThrow("Application not found.");
    });
  });

  describe("getMyApplications (PR #50)", () => {
    it("loads the applicant's applications newest first, without the resume file", async () => {
      const rows = [{ _id: "a2" }, { _id: "a1" }];
      const query = chainableQuery(rows);
      Application.find.mockReturnValue(query);

      const result = await getMyApplications(applicantId);

      expect(result).toBe(rows);
      expect(Application.find).toHaveBeenCalledWith({ applicant: applicantId });
      expect(query.select).toHaveBeenCalledWith("_id job status createdAt updatedAt");
      expect(query.populate).toHaveBeenCalledWith("job", "title company location category");
      expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    });
  });

  describe("getApplicationHistoryByUser (PR #51)", () => {
    it("loads the applicant's history newest first with full job details", async () => {
      const rows = [{ _id: "a1" }];
      const query = chainableQuery(rows);
      Application.find.mockReturnValue(query);

      const result = await getApplicationHistoryByUser(applicantId);

      expect(result).toBe(rows);
      expect(Application.find).toHaveBeenCalledWith({ applicant: applicantId });
      expect(query.populate).toHaveBeenCalledWith(
        "job",
        "title company location category description requirements"
      );
      expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    });
  });
});
