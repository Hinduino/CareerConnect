import {
  deleteResume,
  fetchResumeBlobUrl,
  fetchResumes,
  getResumeFileUrl,
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

  it('builds file URLs and lists saved resumes', async () => {
    expect(getResumeFileUrl('resume-1')).toBe('http://localhost:3000/api/resumes/resume-1/file');
    expect(getResumeFileUrl('resume-1', { download: true })).toBe(
      'http://localhost:3000/api/resumes/resume-1/file?download=1'
    );

    const resumes = [{ id: 'resume-1', originalName: 'resume.pdf' }];
    global.fetch.mockResolvedValue(response(resumes));
    await expect(fetchResumes('token')).resolves.toEqual(resumes);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/resumes', {
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('surfaces an error when listing resumes fails', async () => {
    global.fetch.mockResolvedValue(response({ error: 'boom' }, { ok: false }));
    await expect(fetchResumes('token')).rejects.toThrow('boom');
  });

  it('fetches a resume file with authentication and returns a blob URL', async () => {
    const fileResponse = response({});
    global.fetch.mockResolvedValue(fileResponse);

    await expect(fetchResumeBlobUrl('token', 'resume-1', { download: true })).resolves.toBe('blob:resume');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/resumes/resume-1/file?download=1',
      { headers: { Authorization: 'Bearer token' } },
    );
    expect(URL.createObjectURL).toHaveBeenCalledWith(await fileResponse.blob());
  });

  it('uploads a new resume', async () => {
    const file = new File(['resume'], 'resume.pdf', { type: 'application/pdf' });
    global.fetch.mockResolvedValue(response({ id: 'resume-1', originalName: 'resume.pdf' }));

    await expect(uploadResume('token', file)).resolves.toEqual({ id: 'resume-1', originalName: 'resume.pdf' });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/resumes');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ Authorization: 'Bearer token' });
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('resume')).toBe(file);
  });

  it('surfaces API errors and accepts a no-content delete response', async () => {
    global.fetch.mockResolvedValueOnce(response({ error: 'Invalid file' }, { ok: false }));
    await expect(uploadResume('token', new File(['x'], 'x.pdf'))).rejects.toThrow('Invalid file');

    global.fetch.mockResolvedValueOnce({ status: 204, ok: false, json: jest.fn() });
    await expect(deleteResume('token', 'resume-1')).resolves.toBeUndefined();
    expect(global.fetch.mock.calls[1]).toEqual([
      'http://localhost:3000/api/resumes/resume-1',
      { method: 'DELETE', headers: { Authorization: 'Bearer token' } },
    ]);

    global.fetch.mockResolvedValueOnce(response({ error: 'Delete failed' }, { ok: false }));
    await expect(deleteResume('token', 'resume-1')).rejects.toThrow('Delete failed');
  });
});
