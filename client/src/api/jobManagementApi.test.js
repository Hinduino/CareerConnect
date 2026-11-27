const {
  fetchRecruiterPostings,
  createJobPosting,
  updateJobPosting,
  toggleArchiveJobPosting,
  fetchApplicantsForJob,
} = require('./jobManagementApi');

describe('jobManagementApi', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('fetches recruiter postings from /jobs/mine', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ _id: 'j1', title: 'Dev' }],
    });

    const data = await fetchRecruiterPostings('tok-1');

    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/jobs/mine', {
      method: 'GET',
      headers: { Authorization: 'Bearer tok-1' },
    });
    expect(data).toEqual([{ _id: 'j1', title: 'Dev' }]);
  });

  it('creates, updates, and toggles archive on job postings', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ _id: 'j1' }),
    });

    await createJobPosting('tok-1', { title: 'Dev' });
    expect(global.fetch).toHaveBeenLastCalledWith('http://localhost:3000/api/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok-1',
      },
      body: JSON.stringify({ title: 'Dev' }),
    });

    await updateJobPosting('tok-1', 'j1', { title: 'Senior Dev' });
    expect(global.fetch).toHaveBeenLastCalledWith('http://localhost:3000/api/jobs/j1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer tok-1',
      },
      body: JSON.stringify({ title: 'Senior Dev' }),
    });

    await toggleArchiveJobPosting('tok-1', 'j1');
    expect(global.fetch).toHaveBeenLastCalledWith('http://localhost:3000/api/jobs/j1/archive', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer tok-1' },
    });
  });

  it('fetches applicants for a job posting', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ _id: 'app-1' }],
    });

    const res = await fetchApplicantsForJob('tok-1', 'j1');
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/applications/jobs/j1', {
      method: 'GET',
      headers: { Authorization: 'Bearer tok-1' },
    });
    expect(res).toEqual([{ _id: 'app-1' }]);
  });

  it('throws API error message or fallback error on non-OK responses', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Forbidden' }),
    });
    await expect(fetchRecruiterPostings('tok-1')).rejects.toThrow('Forbidden');

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error('invalid json');
      },
    });
    await expect(toggleArchiveJobPosting('tok-1', 'j1')).rejects.toThrow(
      'Failed to toggle archive status'
    );
  });
});