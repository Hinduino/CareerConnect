import { fetchRecommendations } from './recommendationApi';

const response = (body, { ok = true, jsonError } = {}) => ({
  ok,
  json: jsonError ? jest.fn().mockRejectedValue(jsonError) : jest.fn().mockResolvedValue(body),
});

describe('recommendationApi', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests recommendations with a selected resume', async () => {
    const result = { recommendations: [] };
    global.fetch.mockResolvedValue(response(result));

    await expect(fetchRecommendations('token', 'resume-1')).resolves.toEqual(result);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/recommendations', expect.objectContaining({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token',
      },
      body: JSON.stringify({ resumeId: 'resume-1' }),
      signal: expect.any(AbortSignal),
    }));
  });

  it('uses profile information alone when no resume is selected', async () => {
    global.fetch.mockResolvedValue(response({ recommendations: [] }));

    await fetchRecommendations('token', '');
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ resumeId: null });
  });

  it('rejects a successful response that is not valid recommendations', async () => {
    global.fetch.mockResolvedValue(response(null, { jsonError: new Error('invalid JSON') }));

    await expect(fetchRecommendations('token', null)).rejects.toThrow(/invalid response/i);
  });

  it('rejects malformed recommendation entries before the UI renders them', async () => {
    global.fetch.mockResolvedValue(response({ recommendations: [null] }));

    await expect(fetchRecommendations('token', null)).rejects.toThrow(/invalid response/i);
  });

  it('uses the server error when a request fails', async () => {
    global.fetch.mockResolvedValue(response({ error: 'Recommendation service is busy.' }, { ok: false }));

    await expect(fetchRecommendations('token', null)).rejects.toThrow(
      'Recommendation service is busy.'
    );
  });

  it('uses a fallback error when an unsuccessful response is not JSON', async () => {
    global.fetch.mockResolvedValue(response(null, { ok: false, jsonError: new Error('invalid JSON') }));

    await expect(fetchRecommendations('token', null)).rejects.toThrow(
      'Failed to load job recommendations.'
    );
  });

  it('surfaces an actionable error when the network is unavailable', async () => {
    global.fetch.mockRejectedValue(new TypeError('fetch failed'));

    await expect(fetchRecommendations('token', null))
      .rejects.toThrow('Could not connect to job recommendations.');
  });
});
