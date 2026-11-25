jest.mock("../models/User", () => ({ findById: jest.fn() }));
jest.mock("../models/JobPosting", () => ({ find: jest.fn() }));
jest.mock("../models/Application", () => ({ find: jest.fn() }));

const mongoose = require("mongoose");
const User = require("../models/User");
const JobPosting = require("../models/JobPosting");
const Application = require("../models/Application");
const { generateAssistantReply, loadCareerConnectContext } = require("./chatService");

function createQuery(result) {
  const query = {
    select: jest.fn(() => query),
    sort: jest.fn(() => query),
    limit: jest.fn(() => query),
    populate: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue(result)
  };
  return query;
}

function apiResponse(message, finishReason = "stop") {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({
      choices: [{ message, finish_reason: finishReason }]
    })
  };
}

describe("chatService", () => {
  let fetchMock;
  let errorLog;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock = jest.spyOn(global, "fetch");
    errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
    JobPosting.find.mockReturnValue(createQuery([]));
    User.findById.mockReturnValue(createQuery(null));
    Application.find.mockReturnValue(createQuery([]));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("loadCareerConnectContext", () => {
    it("loads public jobs without querying private user data for anonymous visitors", async () => {
      JobPosting.find.mockReturnValue(createQuery([{
        title: "Engineer",
        company: "Example",
        location: "Montreal",
        category: "Engineering",
        description: "D".repeat(1100),
        requirements: "R".repeat(1300),
        createdAt: new Date("2026-01-01")
      }]));

      const context = await loadCareerConnectContext();

      expect(context.profile).toBeNull();
      expect(context.applications).toEqual([]);
      expect(context.jobs[0].description).toHaveLength(1000);
      expect(context.jobs[0].requirements).toHaveLength(1200);
      expect(User.findById).not.toHaveBeenCalled();
      expect(Application.find).not.toHaveBeenCalled();
      expect(JobPosting.find).toHaveBeenCalledWith({ isArchived: { $ne: true } });
    });

    it("loads signed-in profile and applications while omitting absent job details", async () => {
      User.findById.mockReturnValue(createQuery({
        location: "Toronto",
        bio: "B".repeat(1100),
        email: "private@example.com"
      }));
      Application.find.mockReturnValue(createQuery([
        {
          status: "Applied",
          createdAt: "2026-02-01",
          job: { title: "Developer", company: "Example", location: "Remote", category: "Engineering" }
        },
        { status: "Interview", createdAt: "2026-02-02", job: null }
      ]));

      const userId = "507f1f77bcf86cd799439011";
      const context = await loadCareerConnectContext(userId);

      expect(context.profile).toEqual({ location: "Toronto", bio: "B".repeat(1000) });
      expect(context.applications).toEqual([
        {
          status: "Applied",
          appliedAt: "2026-02-01",
          job: { title: "Developer", company: "Example", location: "Remote", category: "Engineering" }
        },
        { status: "Interview", appliedAt: "2026-02-02", job: null }
      ]);
      const expectedUserId = new mongoose.Types.ObjectId(userId);
      expect(User.findById).toHaveBeenCalledWith(expectedUserId);
      expect(Application.find).toHaveBeenCalledWith({ applicant: expectedUserId });
    });

    it.each([
      ["operator object", { $ne: null }],
      ["malformed ID", "not-an-object-id"]
    ])("rejects %s without querying private data", async (_label, userId) => {
      await expect(loadCareerConnectContext(userId)).rejects.toThrow("Invalid authenticated user ID.");

      expect(JobPosting.find).not.toHaveBeenCalled();
      expect(User.findById).not.toHaveBeenCalled();
      expect(Application.find).not.toHaveBeenCalled();
    });

    it("propagates database failures", async () => {
      JobPosting.find.mockReturnValue({
        select: () => { throw new Error("database unavailable"); }
      });

      await expect(loadCareerConnectContext()).rejects.toThrow("database unavailable");
    });
  });

  describe("generateAssistantReply", () => {
    const conversation = [
      { role: "user", content: "  Which jobs are available?  " }
    ];
    const careerContext = { profile: null, jobs: [], applications: [] };

    it("returns trimmed assistant text and sends the career context", async () => {
      fetchMock.mockResolvedValue(apiResponse({ content: "  Here are some jobs.  " }));

      await expect(generateAssistantReply({
        conversation,
        documentContext: null,
        careerContext
      })).resolves.toBe("Here are some jobs.");

      const request = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(request.messages[1]).toEqual({ role: "user", content: "Which jobs are available?" });
      expect(request.messages[0].content).toContain('"jobs":[]');
      expect(request.max_tokens).toBe(2000);
    });

    it("joins text blocks and uses refusal text when content is absent", async () => {
      fetchMock.mockResolvedValueOnce(apiResponse({
        content: ["Career ", { text: "guidance" }, { image: "ignored" }, 2]
      }));
      await expect(generateAssistantReply({ conversation, careerContext }))
        .resolves.toBe("Career guidance");

      fetchMock.mockResolvedValueOnce(apiResponse({ refusal: "  I cannot help with that. " }));
      await expect(generateAssistantReply({ conversation, careerContext }))
        .resolves.toBe("I cannot help with that.");
    });

    it("limits document context and history to their configured windows", async () => {
      const jobs = Array.from({ length: 22 }, (_, index) => ({
        title: `Job ${index}`,
        description: "D".repeat(700),
        requirements: "R".repeat(1100)
      }));
      const applications = Array.from({ length: 12 }, (_, index) => ({ status: `Status ${index}` }));
      const messages = Array.from({ length: 10 }, (_, index) => ({
        role: index % 2 ? "user" : "assistant",
        content: `Message ${index}`
      }));
      fetchMock.mockResolvedValue(apiResponse({ content: "Document reviewed." }));

      await generateAssistantReply({
        conversation: messages,
        documentContext: { text: "resume text", truncated: true },
        careerContext: {
          profile: { location: "Montreal", bio: "B".repeat(500) },
          jobs,
          applications
        }
      });

      const request = JSON.parse(fetchMock.mock.calls[0][1].body);
      const contextMessage = request.messages[0].content;
      expect(request.messages).toHaveLength(7);
      expect(request.messages[1].content).toBe("Message 4");
      expect(contextMessage).toContain('"Job 19"');
      expect(contextMessage).not.toContain('"Job 20"');
      expect(contextMessage).toContain('"Status 9"');
      expect(contextMessage).not.toContain('"Status 10"');
      expect(contextMessage).toContain("truncated to 12,000 characters");
      expect(request.max_tokens).toBe(1000);
    });

    it.each([
      [401, /denied this request/],
      [403, /denied this request/],
      [404, /could not find model/],
      [429, /rate limit reached/],
      [503, /temporarily unavailable/],
      [400, /rejected the request/]
    ])("maps upstream status %i to a safe error", async (status, message) => {
      fetchMock.mockResolvedValue({ ok: false, status });
      await expect(generateAssistantReply({ conversation, careerContext })).rejects.toThrow(message);
    });

    it("reports response parsing and connection errors", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new SyntaxError("invalid JSON"))
      });
      await expect(generateAssistantReply({ conversation, careerContext }))
        .rejects.toThrow("Kilo AI returned an invalid response.");

      fetchMock.mockRejectedValue(new Error("network unavailable"));
      await expect(generateAssistantReply({ conversation, careerContext }))
        .rejects.toThrow("Could not connect to Kilo AI.");
    });

    it.each(["TimeoutError", "AbortError"])("reports a timed out request (%s)", async (name) => {
      fetchMock.mockRejectedValue(Object.assign(new Error("request stopped"), { name }));
      await expect(generateAssistantReply({ conversation, careerContext }))
        .rejects.toThrow("Kilo AI took too long to respond.");
    });

    it.each([
      ["length", /response limit/],
      ["tool_calls", /unsupported tool-call/],
      ["stop", /returned no text/]
    ])("explains a response without visible text (%s)", async (finishReason, message) => {
      fetchMock.mockResolvedValue(apiResponse({ content: "" }, finishReason));
      await expect(generateAssistantReply({ conversation, careerContext })).rejects.toThrow(message);
      expect(errorLog).toHaveBeenCalled();
    });

    it("rejects assistant responses that exceed the maximum size", async () => {
      fetchMock.mockResolvedValue(apiResponse({ content: "x".repeat(16001) }));
      await expect(generateAssistantReply({ conversation, careerContext }))
        .rejects.toThrow("Kilo AI returned an oversized response.");
    });
  });
});
