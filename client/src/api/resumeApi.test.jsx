import {
  deleteResume,
  fetchResumeBlobUrl,
  fetchResumeMetadata,
  getResumeFileUrl,
  replaceResume,
  uploadResume,
} from './resumeApi';

const response = (body, options = {}) => ({
  status: options.status ?? 200,
  ok: options.ok ?? true,
  json: jest.fn().mockResolvedValue(body),
  blob: jest.fn().mockResolvedValue(new Blob(['resume'])),
});

describe('resumeApi', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    URL.createObjectURL = jest.fn(() => 'blob:resume');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds file URLs and returns null for missing metadata', async () => {
    expect(getResumeFileUrl()).toBe('http://localhost:3000/api/resumes/file');
    expect(getResumeFileUrl({ download: true })).toBe('http://localhost:3000/api/resumes/file?download=1');

    global.fetch.mockResolvedValue(response({ error: 'missing' }, { status: 404, ok: false }));
    await expect(fetchResumeMetadata('token')).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/resumes', {
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('fetches file bytes with authentication and returns a blob URL', async () => {
    const fileResponse = response({});
    global.fetch.mockResolvedValue(fileResponse);

    await expect(fetchResumeBlobUrl('token', { download: true })).resolves.toBe('blob:resume');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/resumes/file?download=1',
      { headers: { Authorization: 'Bearer token' } },
    );
    expect(URL.createObjectURL).toHaveBeenCalledWith(await fileResponse.blob());
  });

  it.each([
    ['uploadResume', uploadResume, 'POST'],
    ['replaceResume', replaceResume, 'PUT'],
  ])('%s sends the file using the expected method', async (_name, operation, method) => {
    const file = new File(['resume'], 'resume.pdf', { type: 'application/pdf' });
    global.fetch.mockResolvedValue(response({ originalName: 'resume.pdf' }));

    await expect(operation('token', file)).resolves.toEqual({ originalName: 'resume.pdf' });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/resumes');
    expect(options.method).toBe(method);
    expect(options.headers).toEqual({ Authorization: 'Bearer token' });
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('resume')).toBe(file);
  });

  it('surfaces API errors and accepts a no-content delete response', async () => {
    global.fetch.mockResolvedValueOnce(response({ error: 'Invalid file' }, { ok: false }));
    await expect(uploadResume('token', new File(['x'], 'x.pdf'))).rejects.toThrow('Invalid file');

    global.fetch.mockResolvedValueOnce({ status: 204, ok: false, json: jest.fn() });
    await expect(deleteResume('token')).resolves.toBeUndefined();
    expect(global.fetch.mock.calls[1][1]).toEqual({
      method: 'DELETE',
      headers: { Authorization: 'Bearer token' },
    });

    global.fetch.mockResolvedValueOnce(response({ error: 'Delete failed' }, { ok: false }));
    await expect(deleteResume('token')).rejects.toThrow('Delete failed');
  });
});
