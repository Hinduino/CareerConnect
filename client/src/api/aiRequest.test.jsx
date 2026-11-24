import { fetchAiResponse } from './aiRequest';

describe('fetchAiResponse', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sets a request timeout and returns successful responses', async () => {
    const response = { ok: true };
    global.fetch.mockResolvedValue(response);

    await expect(fetchAiResponse('/ai', { method: 'POST' }, 'AI service')).resolves.toBe(response);

    expect(global.fetch).toHaveBeenCalledWith('/ai', expect.objectContaining({
      method: 'POST',
      signal: expect.any(AbortSignal),
    }));
  });

  it.each(['TimeoutError', 'AbortError'])('maps %s into a recoverable timeout error', async (name) => {
    global.fetch.mockRejectedValue(Object.assign(new Error('request ended'), { name }));

    await expect(fetchAiResponse('/ai', {}, 'AI service'))
      .rejects.toThrow('AI service timed out. Please try again.');
  });

  it('maps connection failures and preserves unexpected errors', async () => {
    global.fetch.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(fetchAiResponse('/ai', {}, 'AI service'))
      .rejects.toThrow('Could not connect to AI service.');

    global.fetch.mockRejectedValueOnce(new Error('unexpected'));
    await expect(fetchAiResponse('/ai', {}, 'AI service')).rejects.toThrow('unexpected');
  });
});
