const { generateRecommendations } = require("./recommendationService");

const job = {
  _id: { toString: () => "job-1" },
  title: "Engineer",
  company: "Example",
  location: "Montreal",
  category: "Engineering",
  description: "Build products",
  requirements: "JavaScript",
  dueDate: null,
  createdAt: "2026-01-01"
};
const match = {
  jobId: "job-1",
  reason: " Relevant experience ",
  matchedQualifications: [" JavaScript ", "React"],
  gaps: ["Testing"]
};

function responseWithContent(content, choice = {}) {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({
      choices: [{ ...choice, message: { content } }]
    })
  };
}

describe("generateRecommendations", () => {
  let fetchMock;
  let errorLog;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, "fetch");
    errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("normalizes a nested response and returns authoritative job details", async () => {
    fetchMock.mockResolvedValue(responseWithContent(JSON.stringify({
      result: { data: { recommendations: [match] } }
    })));

    const result = await generateRecommendations({
      profile: { location: "Montreal", bio: "Engineer" },
      resumeContext: { text: "JavaScript resume", truncated: true },
      candidateJobs: [job]
    });

    expect(result.recommendations[0]).toEqual({
      job: {
        id: "job-1",
        title: "Engineer",
        company: "Example",
        location: "Montreal",
        category: "Engineering",
        description: "Build products",
        requirements: "JavaScript",
        dueDate: null,
        createdAt: "2026-01-01"
      },
      reason: "Relevant experience",
      matchedQualifications: [" JavaScript ", "React"],
      gaps: ["Testing"]
    });
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const context = JSON.parse(requestBody.messages[1].content);
    expect(context.resumeTextTruncated).toBe(true);
    expect(requestBody.messages[0].content).toContain("Treat the applicant profile");
  });

  it("accepts object and text-block responses, caps results, and trims nested text", async () => {
    const candidateJobs = Array.from({ length: 5 }, (_, index) => ({
      ...job,
      _id: { toString: () => `job-${index + 1}` }
    }));
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{
          message: {
            parsed: {
              recommendations: candidateJobs.map((candidate, index) => ({
                ...match,
                jobId: candidate._id.toString(),
                reason: ` Reason ${index} `
              }))
            }
          }
        }]
      })
    });

    const result = await generateRecommendations({
      profile: null,
      resumeContext: null,
      candidateJobs
    });
    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations[0].reason).toBe("Reason 0");

    fetchMock.mockResolvedValue(responseWithContent([
      "Recommended jobs:",
      { type: "text", text: `\`\`\`json\n${JSON.stringify({ recommendations: [match] })}\n\`\`\`` },
      { type: "image" }
    ]));
    await expect(generateRecommendations({ candidateJobs: [job] }))
      .resolves.toMatchObject({ recommendations: [{ job: { id: "job-1" } }] });
  });

  it("recovers a single recommendation from supported wrapped shapes and stringified JSON", async () => {
    const wrapped = JSON.stringify(JSON.stringify({ recommendations: { jobId: "job-1", ...match } }));
    fetchMock.mockResolvedValue(responseWithContent(wrapped));

    await expect(generateRecommendations({ candidateJobs: [job] }))
      .resolves.toMatchObject({ recommendations: [{ job: { id: "job-1" } }] });

    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        output_text: JSON.stringify({ jobs: [{ ...match }] })
      })
    });
    await expect(generateRecommendations({ candidateJobs: [job] }))
      .resolves.toMatchObject({ recommendations: [{ job: { id: "job-1" } }] });
  });

  it("retries malformed JSON and rejects invalid or duplicate job matches", async () => {
    fetchMock
      .mockResolvedValueOnce(responseWithContent("not JSON"))
      .mockResolvedValueOnce(responseWithContent(JSON.stringify({ recommendations: [match] })));
    await expect(generateRecommendations({ candidateJobs: [job] }))
      .resolves.toMatchObject({ recommendations: [{ reason: "Relevant experience" }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).messages[0].content)
      .toMatch(/previous response was not valid recommendation JSON/i);

    fetchMock.mockResolvedValue(responseWithContent(JSON.stringify({
      recommendations: [match, match]
    })));
    await expect(generateRecommendations({ candidateJobs: [job] }))
      .rejects.toThrow("The recommendation service returned an invalid job match.");
    expect(errorLog).toHaveBeenCalled();
  });

  it("returns an empty list for valid empty recommendations", async () => {
    fetchMock.mockResolvedValue(responseWithContent('{"recommendations":[]}'));
    await expect(generateRecommendations({ candidateJobs: [] }))
      .resolves.toMatchObject({ recommendations: [] });
  });

  it.each([
    [401, /rejected the request/],
    [403, /rejected the request/],
    [404, /temporarily unavailable/],
    [503, /temporarily unavailable/],
    [429, /is busy/],
    [400, /could not process/]
  ])("maps upstream status %i to a safe service error", async (status, message) => {
    fetchMock.mockResolvedValue({ ok: false, status });
    await expect(generateRecommendations({ candidateJobs: [] })).rejects.toThrow(message);
  });

  it("reports invalid response bodies and connection failures", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockRejectedValue(new SyntaxError("invalid JSON"))
    });
    await expect(generateRecommendations({ candidateJobs: [] }))
      .rejects.toThrow("The recommendation service returned an invalid response.");

    fetchMock.mockRejectedValue(new Error("network unavailable"));
    await expect(generateRecommendations({ candidateJobs: [] }))
      .rejects.toThrow("Could not connect to the recommendation service.");
  });

  it.each(["TimeoutError", "AbortError"])("reports request timeouts (%s)", async (name) => {
    fetchMock.mockRejectedValue(Object.assign(new Error("request stopped"), { name }));
    await expect(generateRecommendations({ candidateJobs: [] }))
      .rejects.toThrow("Job recommendations took too long to generate.");
  });
});
