import {
  cancelApplication,
  declineJobOffer,
  fetchApplicationApplicant,
  fetchApplicationResumeBlobUrl,
  fetchApplicationStatus,
  fetchMyApplications,
  submitApplication,
  updateApplicationStatus,
} from './applicationApi';

const response = (body, options = {}) => ({
  ok: options.ok ?? true,
  json: jest.fn().mockResolvedValue(body),
  blob: jest.fn().mockResolvedValue(new Blob(['resume'])),
});

describe('applicationApi', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    URL.createObjectURL = jest.fn(() => 'blob:resume');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('checks application status', async () => {
    global.fetch.mockResolvedValue(response({ applied: true, applicationId: 'app-1' }));
    await expect(fetchApplicationStatus('token', 'job-1')).resolves.toEqual({
      applied: true,
      applicationId: 'app-1',
    });
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/applications/status/job-1', {
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('submits an application with the selected resume', async () => {
    global.fetch.mockResolvedValue(response({ message: 'ok', application: { _id: 'app-1' } }));
    await expect(submitApplication('token', 'job-1', 'resume-1')).resolves.toEqual({
      message: 'ok',
      application: { _id: 'app-1' },
    });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/applications');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ jobId: 'job-1', resumeId: 'resume-1' });
  });

  it('surfaces an error when submission fails', async () => {
    global.fetch.mockResolvedValue(response({ error: 'You have already applied for this job.' }, { ok: false }));
    await expect(submitApplication('token', 'job-1', 'resume-1')).rejects.toThrow(
      'You have already applied for this job.'
    );
  });

  it('cancels an application', async () => {
    global.fetch.mockResolvedValue(response({ message: 'Application cancelled successfully.' }));
    await expect(cancelApplication('token', 'app-1')).resolves.toEqual({
      message: 'Application cancelled successfully.',
    });
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/applications/app-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token' },
    });
  });

  it("fetches an applicant's profile for an application", async () => {
    const payload = {
      applicant: { name: 'Jane Doe', email: 'jane@example.com' },
      resume: { originalName: 'jane-resume.pdf' },
      application: { _id: 'app-1', status: 'Applied' },
    };
    global.fetch.mockResolvedValue(response(payload));

    await expect(fetchApplicationApplicant('token', 'app-1')).resolves.toEqual(payload);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/applications/app-1/applicant',
      { headers: { Authorization: 'Bearer token' } },
    );
  });

  it('surfaces authorization errors when loading an applicant profile', async () => {
    global.fetch.mockResolvedValue(
      response({ error: 'You can only view applicants for your own job postings' }, { ok: false })
    );

    await expect(fetchApplicationApplicant('token', 'app-1')).rejects.toThrow(
      'You can only view applicants for your own job postings'
    );
  });

  it('fetches the logged-in job seeker applications', async () => {
    global.fetch.mockResolvedValue(response([{ _id: 'app-1' }]));

    await expect(fetchMyApplications('token')).resolves.toEqual([{ _id: 'app-1' }]);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/applications/my', {
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('updates an application status', async () => {
    global.fetch.mockResolvedValue(response({ application: { status: 'Interview' } }));

    await expect(updateApplicationStatus('token', 'app-1', 'Interview')).resolves.toEqual({
      application: { status: 'Interview' },
    });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/applications/app-1/status');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ status: 'Interview' });
  });

  it('declines a job offer', async () => {
    global.fetch.mockResolvedValue(response({ message: 'Offer declined successfully.' }));

    await expect(declineJobOffer('token', 'app-1')).resolves.toEqual({
      message: 'Offer declined successfully.',
    });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/applications/app-1/decline-offer');
    expect(options.method).toBe('PATCH');
  });

  it('fetches the resume attached to an application as a blob URL', async () => {
    const fileResponse = response({});
    global.fetch.mockResolvedValue(fileResponse);

    await expect(fetchApplicationResumeBlobUrl('token', 'app-1', { download: true })).resolves.toBe('blob:resume');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/applications/app-1/resume?download=1',
      { headers: { Authorization: 'Bearer token' } },
    );
  });
});
