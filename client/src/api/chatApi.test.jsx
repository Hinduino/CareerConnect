import { sendChatMessage } from './chatApi';

const response = (body, { ok = true, jsonError } = {}) => ({
  ok,
  json: jsonError ? jest.fn().mockRejectedValue(jsonError) : jest.fn().mockResolvedValue(body),
});

describe('chatApi', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends an unauthenticated text conversation as JSON and trims the reply', async () => {
    const messages = [{ role: 'user', content: 'Hello' }];
    global.fetch.mockResolvedValue(response({ reply: '  Hi there.  ' }));

    await expect(sendChatMessage(messages, null, null, '')).resolves.toBe('Hi there.');
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/chat', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: expect.any(AbortSignal),
    }));
  });

  it('sends a document and profile resume as multipart form data with authorization', async () => {
    const messages = [{ role: 'user', content: 'Review my resume' }];
    const document = new File(['resume'], 'resume.pdf', { type: 'application/pdf' });
    global.fetch.mockResolvedValue(response({ reply: 'Reviewed.' }));

    await expect(sendChatMessage(messages, 'token', document, 'resume-1')).resolves.toBe('Reviewed.');

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers).toEqual({ Authorization: 'Bearer token' });
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('messages')).toBe(JSON.stringify(messages));
    expect(options.body.get('document')).toBe(document);
    expect(options.body.get('profileResumeId')).toBe('resume-1');
  });

  it('sends a profile resume as multipart form data without an uploaded document', async () => {
    global.fetch.mockResolvedValue(response({ reply: 'Reviewed.' }));

    await expect(sendChatMessage([], 'token', null, 'resume-1')).resolves.toBe('Reviewed.');

    const [, options] = global.fetch.mock.calls[0];
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('profileResumeId')).toBe('resume-1');
    expect(options.body.get('document')).toBeNull();
  });

  it('sends an attached document without a profile resume', async () => {
    const document = new File(['resume'], 'resume.pdf', { type: 'application/pdf' });
    global.fetch.mockResolvedValue(response({ reply: 'Reviewed.' }));

    await expect(sendChatMessage([], null, document, '')).resolves.toBe('Reviewed.');

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers).toEqual({});
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('document')).toBe(document);
    expect(options.body.get('profileResumeId')).toBeNull();
  });

  it('uses the server error when a request fails', async () => {
    global.fetch.mockResolvedValue(response({ error: 'Chat is unavailable.' }, { ok: false }));

    await expect(sendChatMessage([], 'token', null, '')).rejects.toThrow('Chat is unavailable.');
  });

  it('uses a fallback error when an unsuccessful response is not JSON', async () => {
    global.fetch.mockResolvedValue(response(null, { ok: false, jsonError: new Error('invalid JSON') }));

    await expect(sendChatMessage([], 'token', null, '')).rejects.toThrow(
      'The chat assistant could not respond'
    );
  });

  it('surfaces an actionable error when the network is unavailable', async () => {
    global.fetch.mockRejectedValue(new TypeError('fetch failed'));

    await expect(sendChatMessage([], null, null, ''))
      .rejects.toThrow('Could not connect to the chat assistant.');
  });

  it('uses a fallback error when a successful response is not JSON', async () => {
    global.fetch.mockResolvedValue(response(null, { jsonError: new Error('invalid JSON') }));

    await expect(sendChatMessage([], 'token', null, '')).rejects.toThrow(
      'The chat assistant returned an invalid response'
    );
  });

  it.each([
    [{ reply: '   ' }],
    [{}],
    [null],
  ])('rejects a successful response without a non-empty reply', async (body) => {
    global.fetch.mockResolvedValue(response(body));

    await expect(sendChatMessage([], 'token', null, '')).rejects.toThrow(
      'The chat assistant returned an invalid response'
    );
  });
});
