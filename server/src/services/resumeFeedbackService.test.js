const { generateResumeFeedback } = require("./resumeFeedbackService");

function responseWithMessage(message) {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({ choices: [{ message }] })
  };
}

describe("generateResumeFeedback", () => {
  let fetchMock;
  let errorLog;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, "fetch");
    errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("normalizes parsed feedback and limits the returned text and list sizes", async () => {
    fetchMock.mockResolvedValue(responseWithMessage({
      parsed: {
        summary: ` ${"s".repeat(1100)} `,
        strengths: Array.from({ length: 10 }, (_, index) => ` strength ${index} `),
        recommendations: Array.from({ length: 10 }, (_, index) => ` recommendation ${index} `)
      }
    }));

    const result = await generateResumeFeedback({ text: "resume", truncated: true });

    expect(result.summary).toHaveLength(1000);
    expect(result.strengths).toHaveLength(8);
    expect(result.strengths[0]).toBe("strength 0");
    expect(result.recommendations).toHaveLength(8);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[1].content).toContain('"resumeTextTruncated":true');
  });

  it("extracts JSON from text-block content and accepts object responses", async () => {
    fetchMock.mockResolvedValue(responseWithMessage({
      content: [
        { type: "text", text: "Feedback follows:" },
        { type: "text", text: 'Result: {"summary":" Clear ","strengths":[" Strong "],"recommendations":[" Improve "]} trailing' },
        { type: "image", data: "ignored" }
      ]
    }));

    await expect(generateResumeFeedback({ text: "resume" })).resolves.toEqual({
      summary: "Clear",
      strengths: ["Strong"],
      recommendations: ["Improve"]
    });

    fetchMock.mockResolvedValue(responseWithMessage({
      content: {
        summary: " Clear ",
        strengths: [" Strong "],
        recommendations: [" Improve "]
      }
    }));
    await expect(generateResumeFeedback({ text: "resume" })).resolves.toEqual({
      summary: "Clear",
      strengths: ["Strong"],
      recommendations: ["Improve"]
    });
  });

  it("accepts JSON embedded in explanatory text and retries malformed responses once", async () => {
    fetchMock
      .mockResolvedValueOnce(responseWithMessage({ content: "not JSON" }))
      .mockResolvedValueOnce(responseWithMessage({
        content: 'Here is the feedback: {"summary":"Clear","strengths":["Strong"],"recommendations":["Improve"]}'
      }));

    await expect(generateResumeFeedback({ text: "resume" })).resolves.toMatchObject({
      summary: "Clear"
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).messages[0].content)
      .toMatch(/previous response was not valid feedback JSON/i);
  });

  it("rejects malformed, empty, and incomplete AI feedback", async () => {
    fetchMock.mockResolvedValue(responseWithMessage({ content: "" }));
    await expect(generateResumeFeedback({ text: "resume" }))
      .rejects.toThrow("The AI service returned an invalid feedback response.");
  });

  it("rejects feedback with empty recommendation lists", async () => {
    fetchMock.mockResolvedValue(responseWithMessage({
      content: '{"summary":"Clear","strengths":[],"recommendations":[]}'
    }));

    await expect(generateResumeFeedback({ text: "resume" }))
      .rejects.toThrow("The AI service returned incomplete feedback.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    [429, /temporarily busy/],
    [401, /rejected the request/],
    [403, /rejected the request/],
    [404, /temporarily unavailable/],
    [503, /temporarily unavailable/],
    [400, /could not process/]
  ])("maps upstream status %i to a safe service error", async (status, message) => {
    fetchMock.mockResolvedValue({ ok: false, status });

    await expect(generateResumeFeedback({ text: "resume" })).rejects.toThrow(message);
    expect(errorLog.mock.calls.flat().join(" ")).not.toContain("resume");
  });

  it("reports invalid response bodies and connection failures", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockRejectedValue(new SyntaxError("invalid JSON"))
    });
    await expect(generateResumeFeedback({ text: "resume" }))
      .rejects.toThrow("Resume feedback returned an invalid response.");

    fetchMock.mockRejectedValue(new Error("network unavailable"));
    await expect(generateResumeFeedback({ text: "resume" }))
      .rejects.toThrow("Could not connect to the resume feedback service.");
  });

  it.each(["TimeoutError", "AbortError"])("reports a timed out request (%s)", async (name) => {
    fetchMock.mockRejectedValue(Object.assign(new Error("request stopped"), { name }));

    await expect(generateResumeFeedback({ text: "resume" }))
      .rejects.toThrow("Resume feedback took too long to generate.");
  });

  it("uses reasoning fields when the response has no content and rejects unparseable retries", async () => {
    fetchMock
      .mockResolvedValueOnce(responseWithMessage({
        reasoning_content: '{"summary":"Clear","strengths":["Strong"],"recommendations":["Improve"]}'
      }))
      .mockResolvedValueOnce(responseWithMessage({ content: "still not JSON" }))
      .mockResolvedValueOnce(responseWithMessage({ content: "still not JSON" }));

    await expect(generateResumeFeedback({ text: "resume" })).resolves.toMatchObject({ summary: "Clear" });
    await expect(generateResumeFeedback({ text: "resume" }))
      .rejects.toThrow("The AI service returned unreadable feedback.");
    expect(errorLog).toHaveBeenCalled();
  });
});
