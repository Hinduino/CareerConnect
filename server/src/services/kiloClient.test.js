const { requestKiloCompletion } = require("./kiloClient");

describe("requestKiloCompletion", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("retries once after a transient server error", async () => {
    const success = { ok: true, status: 200 };
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(success);

    await expect(requestKiloCompletion({ prompt: "test" }, 5000)).resolves.toBe(success);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.kilo.ai/api/gateway/chat/completions");
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ prompt: "test" }));
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
  });

  it("retries transient connection failures and rate limits once", async () => {
    const success = { ok: true, status: 200 };
    fetchMock
      .mockRejectedValueOnce(new TypeError("network error"))
      .mockResolvedValueOnce(success);

    await expect(requestKiloCompletion({}, 5000)).resolves.toBe(success);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce(success);
    await expect(requestKiloCompletion({}, 5000)).resolves.toBe(success);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry timeouts or client errors", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    await expect(requestKiloCompletion({}, 5000)).rejects.toThrow("timed out");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: false, status: 400 });
    await expect(requestKiloCompletion({}, 5000)).resolves.toMatchObject({ status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
