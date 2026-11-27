jest.mock("../middleware/auth", () => jest.fn((req, res, next) => {
  req.user = { id: "507f1f77bcf86cd799439011" };
  return next();
}));
jest.mock("../utils/documentText", () => jest.fn());
jest.mock("../utils/documentFile", () => ({
  hasSupportedDocumentSignature: jest.fn()
}));
jest.mock("../models/Resume", () => ({
  findOne: jest.fn()
}));
jest.mock("../services/chatService", () => ({
  generateAssistantReply: jest.fn(),
  loadCareerConnectContext: jest.fn()
}));

const express = require("express");
const request = require("supertest");
const requireAuth = require("../middleware/auth");
const extractDocumentText = require("../utils/documentText");
const { hasSupportedDocumentSignature } = require("../utils/documentFile");
const Resume = require("../models/Resume");
const {
  generateAssistantReply,
  loadCareerConnectContext
} = require("../services/chatService");
const chatRoutes = require("./chatRoutes");

const USER_ID = "507f1f77bcf86cd799439011";
const RESUME_ID = "507f1f77bcf86cd799439012";
const messages = [{ role: "user", content: "Hello" }];
const pdf = Buffer.from("%PDF-1.7 document");
const app = express();
app.use(express.json());
app.use("/api/chat", chatRoutes);

function resumeQuery(result) {
  return { select: jest.fn().mockResolvedValue(result) };
}

function sendDocument() {
  return request(app)
    .post("/api/chat")
    .field("messages", JSON.stringify(messages))
    .attach("document", pdf, { filename: "resume.pdf", contentType: "application/pdf" });
}

describe("chat route", () => {
  let errorLog;

  beforeEach(() => {
    jest.clearAllMocks();
    errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
    requireAuth.mockImplementation((req, res, next) => {
      req.user = { id: USER_ID };
      next();
    });
    hasSupportedDocumentSignature.mockReturnValue(true);
    extractDocumentText.mockResolvedValue({ text: "Resume text", truncated: false });
    loadCareerConnectContext.mockResolvedValue({ profile: null, jobs: [], applications: [] });
    generateAssistantReply.mockResolvedValue("Hello there.");
    Resume.findOne.mockReturnValue(resumeQuery({
      originalName: "resume.pdf",
      contentType: "application/pdf",
      data: pdf
    }));
  });

  afterEach(() => {
    errorLog.mockRestore();
  });

  it("allows anonymous requests when no authorization header is present", async () => {
    const response = await request(app).post("/api/chat").send({ messages });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ reply: "Hello there." });
    expect(requireAuth).not.toHaveBeenCalled();
    expect(loadCareerConnectContext).toHaveBeenCalledWith(undefined);
  });

  it("uses optional authentication when credentials are provided", async () => {
    const response = await request(app)
      .post("/api/chat")
      .set("Authorization", "Bearer token")
      .send({ messages });

    expect(response.status).toBe(200);
    expect(requireAuth).toHaveBeenCalledTimes(1);
    expect(loadCareerConnectContext).toHaveBeenCalledWith(USER_ID);
  });

  it.each([
    ["malformed JSON", { messages: "not JSON" }, /valid JSON/],
    ["missing messages", {}, /ending with a user message/],
    ["empty messages", { messages: [] }, /ending with a user message/],
    ["too many messages", {
        messages: Array.from({ length: 21 }, () => ({ role: "user", content: "Hello" }))
    }, /up to 20/],
    ["assistant-ending conversation", {
      messages: [{ role: "assistant", content: "Hello" }]
    }, /ending with a user message/]
  ])("rejects %s", async (_label, body, expectedError) => {
    const response = await request(app).post("/api/chat").send(body);
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(expectedError);
    expect(loadCareerConnectContext).not.toHaveBeenCalled();
    expect(generateAssistantReply).not.toHaveBeenCalled();
  });

  it.each([
    ["null message", [null, { role: "user", content: "Hello" }]],
    ["unsupported role", [{ role: "system", content: "Hello" }, { role: "user", content: "Hello" }]],
    ["non-string content", [{ role: "user", content: 3 }]],
    ["empty content", [{ role: "user", content: "  " }]],
    ["overlong content", [{ role: "user", content: "x".repeat(2001) }]]
  ])("rejects invalid message details (%s)", async (_label, conversation) => {
    const response = await request(app).post("/api/chat").send({ messages: conversation });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/1-2000 characters/);
  });

  it("rejects invalid profile resume IDs before looking up a resume", async () => {
    const response = await request(app)
      .post("/api/chat")
      .set("Authorization", "Bearer token")
      .send({ messages, profileResumeId: { $ne: null } });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Invalid profile resume ID/);
    expect(Resume.findOne).not.toHaveBeenCalled();
  });

  it("requires authentication and valid IDs for saved profile resumes", async () => {
    const unauthenticated = await request(app)
      .post("/api/chat")
      .send({ messages, profileResumeId: RESUME_ID });
    expect(unauthenticated.status).toBe(401);
    expect(Resume.findOne).not.toHaveBeenCalled();

    const invalidId = await request(app)
      .post("/api/chat")
      .set("Authorization", "Bearer token")
      .send({ messages, profileResumeId: "invalid-id" });
    expect(invalidId.status).toBe(400);
    expect(Resume.findOne).not.toHaveBeenCalled();
  });

  it("returns not found when a saved resume is missing or has no file data", async () => {
    Resume.findOne.mockReturnValueOnce(resumeQuery(null)).mockReturnValueOnce(resumeQuery({
      originalName: "resume.pdf",
      contentType: "application/pdf",
      data: null
    }));

    for (let index = 0; index < 2; index += 1) {
      const response = await request(app)
        .post("/api/chat")
        .set("Authorization", "Bearer token")
        .send({ messages, profileResumeId: RESUME_ID });
      expect(response.status).toBe(404);
    }
    expect(extractDocumentText).not.toHaveBeenCalled();
  });

  it("rejects saved resumes that fail signature validation", async () => {
    hasSupportedDocumentSignature.mockReturnValue(false);

    const response = await request(app)
      .post("/api/chat")
      .set("Authorization", "Bearer token")
      .send({ messages, profileResumeId: RESUME_ID });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/saved profile resume is not a valid/);
    expect(extractDocumentText).not.toHaveBeenCalled();
  });

  it("maps unreadable and invalid attached documents to client errors", async () => {
    extractDocumentText.mockRejectedValueOnce(new Error("No readable text was found in the document"));
    const unreadable = await sendDocument();
    expect(unreadable.status).toBe(400);
    expect(unreadable.body.error).toMatch(/No readable text/);

    extractDocumentText.mockRejectedValueOnce(new Error("parser failure"));
    const invalid = await sendDocument();
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toMatch(/Could not read this document/);
  });

  it("rejects files that fail signature validation and prevents mixing resume sources", async () => {
    const both = await request(app)
      .post("/api/chat")
      .set("Authorization", "Bearer token")
      .field("messages", JSON.stringify(messages))
      .field("profileResumeId", RESUME_ID)
      .attach("document", pdf, { filename: "resume.pdf", contentType: "application/pdf" });
    expect(both.status).toBe(400);
    expect(both.body.error).toMatch(/either an attached document or a profile resume/);

    hasSupportedDocumentSignature.mockReturnValue(false);
    const invalidFile = await sendDocument();
    expect(invalidFile.status).toBe(400);
    expect(invalidFile.body.error).toMatch(/file contents do not match/);
    expect(extractDocumentText).not.toHaveBeenCalled();
  });

  it("reports selected-resume extraction failures without exposing parser errors", async () => {
    extractDocumentText.mockRejectedValueOnce(new Error("No readable text was found in the document"));
    const unreadable = await request(app)
      .post("/api/chat")
      .set("Authorization", "Bearer token")
      .send({ messages, profileResumeId: RESUME_ID });
    expect(unreadable.status).toBe(400);
    expect(unreadable.body.error).toMatch(/No readable text/);

    extractDocumentText.mockRejectedValueOnce(new Error("private parser details"));
    const invalid = await request(app)
      .post("/api/chat")
      .set("Authorization", "Bearer token")
      .send({ messages, profileResumeId: RESUME_ID });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toMatch(/Could not analyze your profile resume/);
    expect(errorLog.mock.calls.flat().join(" ")).not.toContain("private parser details");
  });

  it("reports resume lookup, context loading, and AI generation failures", async () => {
    Resume.findOne.mockReturnValueOnce({
      select: jest.fn().mockRejectedValue(new Error("database failure"))
    });
    const resumeFailure = await request(app)
      .post("/api/chat")
      .set("Authorization", "Bearer token")
      .send({ messages, profileResumeId: RESUME_ID });
    expect(resumeFailure.status).toBe(500);
    expect(resumeFailure.body.error).toMatch(/Could not load your profile resume/);

    loadCareerConnectContext.mockRejectedValueOnce(new Error("database failure"));
    const contextFailure = await request(app).post("/api/chat").send({ messages });
    expect(contextFailure.status).toBe(500);
    expect(contextFailure.body.error).toMatch(/Could not load CareerConnect data/);

    generateAssistantReply.mockRejectedValueOnce(new Error("AI unavailable"));
    const serviceFailure = await request(app).post("/api/chat").send({ messages });
    expect(serviceFailure.status).toBe(502);
    expect(serviceFailure.body.error).toBe("AI unavailable");
  });

  it("extracts attached documents and passes the resulting context to the service", async () => {
    const response = await sendDocument();

    expect(response.status).toBe(200);
    expect(extractDocumentText).toHaveBeenCalledWith(expect.objectContaining({
      originalname: "resume.pdf"
    }));
    expect(generateAssistantReply).toHaveBeenCalledWith({
      conversation: messages,
      documentContext: { text: "Resume text", truncated: false },
      careerContext: { profile: null, jobs: [], applications: [] }
    });
  });
});
