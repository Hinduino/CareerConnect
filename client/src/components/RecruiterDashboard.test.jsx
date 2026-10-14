const { fireEvent, render, screen, waitFor } = require('@testing-library/react');

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/jobApi', () => ({
  fetchMyJobs: jest.fn(),
  createJob: jest.fn(),
  updateJob: jest.fn(),
  deleteJob: jest.fn(),
}));

const RecruiterDashboard = require('./RecruiterDashboard').default;
const { useAuth } = require('../context/AuthContext');
const { fetchMyJobs, createJob, updateJob, deleteJob} = require('../api/jobApi');

const sampleJob = {
  _id: 'job-1',
  title: 'Backend Engineer',
  company: 'Acme Corp',
  location: 'Remote',
  category: 'Engineering',
  description: 'Build APIs.',
  requirements: '2+ years',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('RecruiterDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ token: 'token' });
    fetchMyJobs.mockResolvedValue([sampleJob]);
  });

  it('loads and displays the recruiter\'s own postings with a posted date', async () => {
    render(<RecruiterDashboard onBack={() => {}} />);

    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument();
    expect(fetchMyJobs).toHaveBeenCalledWith('token');
    expect(screen.getByText(/Posted today/)).toBeInTheDocument();
  });

  it('shows an empty state when the recruiter has no postings', async () => {
    fetchMyJobs.mockResolvedValue([]);
    render(<RecruiterDashboard onBack={() => {}} />);

    expect(await screen.findByText(/haven't posted any jobs yet/)).toBeInTheDocument();
  });

  it('creates a new job posting through the form', async () => {
    createJob.mockResolvedValue({ ...sampleJob, _id: 'job-2', title: 'New Role' });
    fetchMyJobs.mockResolvedValueOnce([]).mockResolvedValueOnce([{ ...sampleJob, _id: 'job-2', title: 'New Role' }]);
    render(<RecruiterDashboard onBack={() => {}} />);

    await screen.findByText(/haven't posted any jobs yet/);
    fireEvent.click(screen.getByText('Post a New Job'));

    fireEvent.change(screen.getByLabelText('Job Title'), { target: { value: 'New Role' } });
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Acme Corp' } });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Remote' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Engineering' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Build things.' } });
    fireEvent.change(screen.getByLabelText('Requirements'), { target: { value: '1+ years' } });

    fireEvent.click(screen.getByText('Post Job'));

    await waitFor(() => expect(createJob).toHaveBeenCalledWith('token', expect.objectContaining({ title: 'New Role' })));
    expect(await screen.findByText('New Role')).toBeInTheDocument();
  });

  it('edits an existing posting', async () => {
    updateJob.mockResolvedValue({ ...sampleJob, title: 'Updated Title' });
    render(<RecruiterDashboard onBack={() => {}} />);

    await screen.findByText('Backend Engineer');
    fireEvent.click(screen.getByText('Edit Posting'));

    const titleInput = screen.getByLabelText('Job Title');
    expect(titleInput.value).toBe('Backend Engineer');
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() =>
      expect(updateJob).toHaveBeenCalledWith('token', 'job-1', expect.objectContaining({ title: 'Updated Title' }))
    );
  });
  // Verify that confirming deletion removes the posting.
it('deletes a job posting after confirmation', async () => {
  window.confirm = jest.fn(() => true);
  deleteJob.mockResolvedValue({ message: 'Job posting deleted successfully' });

  render(<RecruiterDashboard onBack={() => {}} />);

  await screen.findByText('Backend Engineer');
  fireEvent.click(screen.getByText('Delete Posting'));

  expect(window.confirm).toHaveBeenCalled();

  await waitFor(() => {
    expect(deleteJob).toHaveBeenCalledWith('token', 'job-1');
    expect(screen.queryByText('Backend Engineer')).not.toBeInTheDocument();
  });
});

// Verify that cancelling deletion keeps the posting.
it('does not delete a posting when confirmation is cancelled', async () => {
  window.confirm = jest.fn(() => false);

  render(<RecruiterDashboard onBack={() => {}} />);

  await screen.findByText('Backend Engineer');
  fireEvent.click(screen.getByText('Delete Posting'));

  expect(deleteJob).not.toHaveBeenCalled();
  expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
  });
});
