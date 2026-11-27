import { API_BASE, authHeaders, fetchBlobUrl, parseJsonSafely, requestJson } from './http';

// Responses whose body is null simulate an empty reply (response.json() throws).
const response = ({ ok = true, body = null } = {}) => ({
  ok,
  json: body === null
    ? jest.fn().mockRejectedValue(new Error('no body'))
    : jest.fn().mockResolvedValue(body),
  blob: jest.fn().mockResolvedValue(new Blob(['file-bytes'])),
});

describe('http helpers', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds a bearer authorization header', () => {
    expect(authHeaders('token')).toEqual({ Authorization: 'Bearer token' });
  });

  it('parses an unreadable body as null', async () => {
    await expect(parseJsonSafely(response({}))).resolves.toBeNull();
  });

  describe('requestJson', () => {
    it('sends a bare GET request when no options are given', async () => {
      global.fetch.mockResolvedValue(response({ body: { pong: true } }));

      await expect(requestJson('/ping')).resolves.toEqual({ pong: true });
      expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/ping`, {});
    });

    it('falls back to a generic message when a failure has no body or fallback', async () => {
      global.fetch.mockResolvedValue(response({ ok: false }));

      await expect(requestJson('/ping')).rejects.toThrow('Request failed');
    });
  });

  describe('fetchBlobUrl', () => {
    beforeEach(() => {
      URL.createObjectURL = jest.fn(() => 'blob:url');
    });

    it('returns a blob URL for the fetched file', async () => {
      global.fetch.mockResolvedValue(response({}));

      await expect(fetchBlobUrl('/file', 'token', 'fallback')).resolves.toBe('blob:url');
      expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/file`, {
        headers: { Authorization: 'Bearer token' },
      });
    });

    it('throws the server-provided error message', async () => {
      global.fetch.mockResolvedValue(response({ ok: false, body: { error: 'Resume not found' } }));

      await expect(fetchBlobUrl('/file', 'token', 'fallback')).rejects.toThrow('Resume not found');
    });

    it('falls back to the caller message when the body has none', async () => {
      global.fetch.mockResolvedValue(response({ ok: false }));

      await expect(fetchBlobUrl('/file', 'token', 'fallback')).rejects.toThrow('fallback');
    });

    it('falls back to a generic message when no caller message is given', async () => {
      global.fetch.mockResolvedValue(response({ ok: false }));

      await expect(fetchBlobUrl('/file', 'token')).rejects.toThrow('Failed to fetch file');
    });
  });
});
