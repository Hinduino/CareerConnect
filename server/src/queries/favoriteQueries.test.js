const User = require("../models/User");
const JobPosting = require("../models/JobPosting");
const {
  toggleFavoriteJob,
  getFavoriteJobIds,
  getFavoriteJobs,
} = require("./favoriteQueries");

jest.mock("../models/User");
jest.mock("../models/JobPosting");

describe("favoriteQueries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("toggleFavoriteJob", () => {
    it("throws when job does not exist", async () => {
      JobPosting.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      await expect(toggleFavoriteJob("u1", "j1")).rejects.toThrow("Job not found.");
    });

    it("throws when user does not exist", async () => {
      JobPosting.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: "j1" }) });
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      await expect(toggleFavoriteJob("u1", "j1")).rejects.toThrow("User not found.");
    });

    it("adds job to savedJobs when not already saved", async () => {
      JobPosting.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: "j1" }) });
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ savedJobs: [] }) });
      User.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue({ savedJobs: ["j1"] }),
      });

      const res = await toggleFavoriteJob("u1", "j1");

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        "u1",
        { $addToSet: { savedJobs: "j1" } },
        { new: true }
      );
      expect(res).toEqual({ favorited: true, savedJobIds: ["j1"] });
    });

    it("removes job from savedJobs when already saved", async () => {
      JobPosting.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: "j1" }) });
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ savedJobs: ["j1"] }) });
      User.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue({ savedJobs: [] }),
      });

      const res = await toggleFavoriteJob("u1", "j1");

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        "u1",
        { $pull: { savedJobs: "j1" } },
        { new: true }
      );
      expect(res).toEqual({ favorited: false, savedJobIds: [] });
    });
  });

  describe("getFavoriteJobIds", () => {
    it("throws when user is not found", async () => {
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      await expect(getFavoriteJobIds("u1")).rejects.toThrow("User not found.");
    });

    it("returns stringified saved job IDs", async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({ savedJobs: ["j1", "j2"] }),
      });

      const ids = await getFavoriteJobIds("u1");
      expect(ids).toEqual(["j1", "j2"]);
    });
  });

  describe("getFavoriteJobs", () => {
    it("throws when user is not found", async () => {
      const populateMock = jest.fn().mockResolvedValue(null);
      User.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ populate: populateMock }) });

      await expect(getFavoriteJobs("u1")).rejects.toThrow("User not found.");
    });

    it("returns non-null populated job postings", async () => {
      const mockJobs = [{ _id: "j1", title: "Engineer" }, null];
      const populateMock = jest.fn().mockResolvedValue({ savedJobs: mockJobs });
      User.findById.mockReturnValue({ select: jest.fn().mockReturnValue({ populate: populateMock }) });

      const jobs = await getFavoriteJobs("u1");
      expect(jobs).toEqual([{ _id: "j1", title: "Engineer" }]);
    });
  });
});