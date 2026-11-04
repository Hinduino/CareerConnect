jest.mock("../models/Resume", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn(),
}));

const Resume = require("../models/Resume");
const {
  listResumesByUser,
  findResumeMetaById,
  findResumeByIdForUser,
  createResume,
  replaceResumeById,
  deleteResumeById,
} = require("./resumeQueries");

const userId = "507f1f77bcf86cd799439011";
const resumeId = "507f1f77bcf86cd799439022";
const file = {
  originalName: "resume.pdf",
  contentType: "application/pdf",
  size: 4,
  data: Buffer.from("test"),
};

describe("resumeQueries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists a user's resumes sorted by most recent, without file bytes", async () => {
    const sort = jest.fn().mockResolvedValue([{ _id: resumeId, ...file }]);
    const select = jest.fn().mockReturnValue({ sort });
    Resume.find.mockReturnValue({ select });

    await expect(listResumesByUser(userId)).resolves.toEqual([{ _id: resumeId, ...file }]);
    expect(Resume.find).toHaveBeenCalledWith({ user: userId });
    expect(select).toHaveBeenCalledWith("_id originalName contentType size createdAt");
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it("finds one resume's metadata scoped to its owner", async () => {
    const select = jest.fn().mockResolvedValue({ _id: resumeId });
    Resume.findOne.mockReturnValue({ select });

    await expect(findResumeMetaById(resumeId, userId)).resolves.toEqual({ _id: resumeId });
    expect(Resume.findOne).toHaveBeenCalledWith({ _id: resumeId, user: userId });
    expect(select).toHaveBeenCalledWith("_id originalName contentType size createdAt");
  });

  it("loads file bytes explicitly, scoped to the owner, for the download route", async () => {
    const select = jest.fn().mockResolvedValue({ _id: resumeId, ...file });
    Resume.findOne.mockReturnValue({ select });

    await expect(findResumeByIdForUser(resumeId, userId)).resolves.toEqual({ _id: resumeId, ...file });
    expect(select).toHaveBeenCalledWith("_id originalName contentType size createdAt +data");
  });

  it("creates a new resume for the user and returns its metadata", async () => {
    Resume.create.mockResolvedValue({ _id: resumeId });
    const select = jest.fn().mockResolvedValue({ _id: resumeId, ...file });
    Resume.findOne.mockReturnValue({ select });

    await expect(createResume(userId, file)).resolves.toEqual({ _id: resumeId, ...file });
    expect(Resume.create).toHaveBeenCalledWith({ user: userId, ...file });
  });

  it("replaces a resume's file in place, scoped to its owner", async () => {
    Resume.updateOne.mockResolvedValue({ matchedCount: 1 });
    const select = jest.fn().mockResolvedValue({ _id: resumeId, ...file });
    Resume.findOne.mockReturnValue({ select });

    await expect(replaceResumeById(resumeId, userId, file)).resolves.toEqual({ _id: resumeId, ...file });
    expect(Resume.updateOne).toHaveBeenCalledWith(
      { _id: resumeId, user: userId },
      { $set: file }
    );
  });

  it("returns null when replacing a resume that doesn't exist or belongs to someone else", async () => {
    Resume.updateOne.mockResolvedValue({ matchedCount: 0 });
    Resume.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    await expect(replaceResumeById(resumeId, userId, file)).resolves.toBeNull();
  });

  it("deletes a resume scoped to its owner and reports whether one was found", async () => {
    Resume.deleteOne.mockResolvedValue({ deletedCount: 1 });
    await expect(deleteResumeById(resumeId, userId)).resolves.toBe(true);
    expect(Resume.deleteOne).toHaveBeenCalledWith({ _id: resumeId, user: userId });

    Resume.deleteOne.mockResolvedValue({ deletedCount: 0 });
    await expect(deleteResumeById(resumeId, userId)).resolves.toBe(false);
  });
});
