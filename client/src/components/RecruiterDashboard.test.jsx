const { fireEvent, render, screen, waitFor } = require('@testing-library/react');

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/jobApi', () => ({
  fetchMyJobs: jest.fn(),
  createJob: jest.fn(),
  updateJob: jest.fn(),
  deleteJob: jest.fn(),
  fetchJobApplications: jest.fn(),
}));
jest.mock('../api/applicationApi', () => ({
  fetchApplicationResumeBlobUrl: jest.fn(),
  fetchApplicationApplicant: jest.fn(),
  updateApplicationStatus: jest.fn(),
}));

const RecruiterDashboard = require('./RecruiterDashboard').default;
const { useAuth } = require('../context/AuthContext');
const { fetchMyJobs, createJob, updateJob, deleteJob, fetchJobApplications } = require('../api/jobApi');
const {
  fetchApplicationResumeBlobUrl,
  fetchApplicationApplicant,
  updateApplicationStatus,
} = require('../api/applicationApi');

// A single timestamp keeps createdAt === updatedAt, so the "Updated" badge
// is deterministically hidden for this job.
const postedAt = new Date().toISOString();

const sampleJob = {
  _id: 'job-1',
  title: 'Backend Engineer',
  company: 'Acme Corp',
  location: 'Remote',
  category: 'Engineering',
  description: 'Build APIs.',
  requirements: '2+ years',
  createdAt: postedAt,
  updatedAt: postedAt,
};

describe('RecruiterDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ token: 'token' });
    fetchMyJobs.mockResolvedValue([sampleJob]);
  });

  it("loads and displays the recruiter's own postings with a posted date", async () => {
    render(<RecruiterDashboard onBack={() => {}} />);

    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument();
    expect(fetchMyJobs).toHaveBeenCalledWith('token');
    expect(screen.getByText(/Posted today/)).toBeInTheDocument();
  });

  it("shows an empty state when the recruiter has no postings", async () => {
    fetchMyJobs.mockResolvedValue([]);
    render(<RecruiterDashboard onBack={() => {}} />);

    expect(await screen.findByText(/haven't posted any jobs yet/)).toBeInTheDocument();
  });

  it('creates a new job posting through the form', async () => {
    createJob.mockResolvedValue({ ...sampleJob, _id: 'job-2', title: 'New Role' });
    fetchMyJobs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...sampleJob, _id: 'job-2', title: 'New Role' }]);
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

    await waitFor(() =>
      expect(createJob).toHaveBeenCalledWith('token', expect.objectContaining({ title: 'New Role' }))
    );
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
      expect(updateJob).toHaveBeenCalledWith(
        'token',
        'job-1',
        expect.objectContaining({ title: 'Updated Title' })
      )
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

  it("opens an applicant's profile from the applications table", async () => {
    const sampleApplication = {
      _id: 'app-1',
      status: 'Applied',
      createdAt: new Date().toISOString(),
      applicant: { name: 'Jane Doe', email: 'jane@example.com', location: 'Montreal' },
      resume: { originalName: 'jane-resume.pdf' },
    };
    fetchJobApplications.mockResolvedValue([sampleApplication]);
    fetchApplicationApplicant.mockResolvedValue({
      applicant: {
        id: 'user-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'job_seeker',
        location: 'Montreal',
        bio: 'Full-stack developer',
      },
      resume: { originalName: 'jane-resume.pdf', contentType: 'application/pdf', size: 2048 },
      application: {
        _id: 'app-1',
        status: 'Applied',
        job: { _id: 'job-1', title: 'Backend Engineer', company: 'Acme Corp' },
      },
    });

    render(<RecruiterDashboard onBack={() => {}} />);

    await screen.findByText('Backend Engineer');
    fireEvent.click(screen.getByText('View Applications'));

    await screen.findByText('Jane Doe');
    fireEvent.click(screen.getByText('View Profile'));

    expect(await screen.findByText('Applicant Profile')).toBeInTheDocument();
    expect(fetchApplicationApplicant).toHaveBeenCalledWith('token', 'app-1');
    expect(await screen.findByText('Full-stack developer')).toBeInTheDocument();

    // Closing the dialog returns to the applications table.
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByText('Applicant Profile')).not.toBeInTheDocument();
  });

  it('lists applications for a posting and downloads an attached resume', async () => {
    const sampleApplication = {
      _id: 'app-1',
      status: 'Applied',
      createdAt: new Date().toISOString(),
      applicant: { name: 'Jane Doe', email: 'jane@example.com', location: 'Montreal' },
      resume: { originalName: 'jane-resume.pdf' },
    };
    fetchJobApplications.mockResolvedValue([sampleApplication]);
    fetchApplicationResumeBlobUrl.mockResolvedValue('blob:resume');
    URL.createObjectURL = jest.fn();
    URL.revokeObjectURL = jest.fn();

    render(<RecruiterDashboard onBack={() => {}} />);

    await screen.findByText('Backend Engineer');
    fireEvent.click(screen.getByText('View Applications'));

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(fetchJobApplications).toHaveBeenCalledWith('token', 'job-1');

    fireEvent.click(screen.getByText('Download Resume'));

    await waitFor(() =>
      expect(fetchApplicationResumeBlobUrl).toHaveBeenCalledWith('token', 'app-1', { download: true })
    );
  });

  it('updates only the changed application status in the per-posting view', async () => {
    const interviewDate = '2026-12-01T14:30';
    const appOne = {
      _id: 'app-1',
      status: 'Applied',
      createdAt: new Date().toISOString(),
      applicant: { name: 'Jane Doe', email: 'jane@example.com', location: 'Montreal' },
      resume: { originalName: 'jane-resume.pdf' },
    };
    const appTwo = {
      _id: 'app-2',
      status: 'Applied',
      createdAt: new Date().toISOString(),
      applicant: { name: 'Applicant', email: 'Unavailable', location: 'Not provided' },
      resume: { originalName: 'app-resume.pdf' },
    };

    fetchJobApplications.mockResolvedValue([appOne, appTwo]);
    updateApplicationStatus.mockResolvedValue({
      application: {
        _id: 'app-1',
        status: 'Interview',
        interviewDate: new Date(interviewDate).toISOString(),
      },
    });

    render(<RecruiterDashboard onBack={() => {}} />);

    await screen.findByText('Backend Engineer');
    fireEvent.click(screen.getByText('View Applications'));

    const select = await screen.findByLabelText('Application status for Jane Doe');
    fireEvent.change(select, { target: { value: 'Interview' } });

    const dateInput = await screen.findByLabelText(/Interview Date & Time/i);
    fireEvent.change(dateInput, { target: { value: interviewDate } });
    fireEvent.click(screen.getByText('Confirm & Send Invite'));

    await waitFor(() => expect(select).toHaveValue('Interview'));
    expect(updateApplicationStatus).toHaveBeenCalledWith(
      'token',
      'app-1',
      'Interview',
      expect.any(String)
    );
    expect(screen.getByLabelText('Application status for Applicant')).toHaveValue('Applied');
  });
});

describe('RecruiterDashboard edge cases', () => {
  const sampleApplication = {
    _id: 'app-1',
    status: 'Applied',
    createdAt: new Date().toISOString(),
    applicant: { name: 'Jane Doe', email: 'jane@example.com', location: 'Montreal' },
    resume: { originalName: 'jane-resume.pdf' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ token: 'token' });
    fetchMyJobs.mockResolvedValue([sampleJob]);
  });

  it('clears the postings instead of fetching when there is no auth token', async () => {
    useAuth.mockReturnValue({ token: null });

    render(<RecruiterDashboard onBack={() => {}} />);

    expect(screen.getByText('Loading your job postings...')).toBeInTheDocument();
    await waitFor(() => expect(fetchMyJobs).not.toHaveBeenCalled());
  });

  it('shows an error when the postings cannot be loaded', async () => {
    fetchMyJobs.mockRejectedValue(new Error('Server error loading jobs'));

    render(<RecruiterDashboard onBack={() => {}} />);

    expect(await screen.findByText('Server error loading jobs')).toBeInTheDocument();
  });

  it('shows an updated date when a posting was edited after creation', async () => {
    fetchMyJobs.mockResolvedValue([
      { ...sampleJob, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-20T00:00:00Z' },
    ]);

    render(<RecruiterDashboard onBack={() => {}} />);

    expect(await screen.findByText(/Updated/)).toBeInTheDocument();
  });

  it('shows an error when the applications for a posting cannot be loaded', async () => {
    fetchJobApplications.mockRejectedValue(new Error('Cannot load applications'));

    render(<RecruiterDashboard onBack={() => {}} />);

    await screen.findByText('Backend Engineer');
    fireEvent.click(screen.getByText('View Applications'));

    expect(await screen.findByText('Cannot load applications')).toBeInTheDocument();
  });

  it('shows an empty state when a posting has no applications', async () => {
    fetchJobApplications.mockResolvedValue([]);

    render(<RecruiterDashboard onBack={() => {}} />);

    await screen.findByText('Backend Engineer');
    fireEvent.click(screen.getByText('View Applications'));

    expect(await screen.findByText('No applications received yet.')).toBeInTheDocument();
  });

  it('returns from the applications view to the postings list', async () => {
    fetchJobApplications.mockResolvedValue([]);

    render(<RecruiterDashboard onBack={() => {}} />);

    await screen.findByText('Backend Engineer');
    fireEvent.click(screen.getByText('View Applications'));
    await screen.findByText('No applications received yet.');

    fireEvent.click(screen.getByText('Back to Postings'));

    expect(await screen.findByText('Post a New Job')).toBeInTheDocument();
  });

  it('falls back to placeholders when an applicant has no profile details', async () => {
    const otherApplication = {
      _id: 'app-2',
      status: 'Applied',
      createdAt: new Date().toISOString(),
      applicant: {},
      resume: {},
    };
    fetchJobApplications.mockResolvedValue([sampleApplication, otherApplication]);

    render(<RecruiterDashboard onBack={() => {}} />);

    await screen.findByText('Backend Engineer');
    fireEvent.click(screen.getByText('View Applications'));
    await screen.findByText('Jane Doe');

    expect(screen.getByRole('cell', { name: 'Applicant' })).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Not provided')).toBeInTheDocument();
  });

  it('downloads under a generic filename when the resume has no name', async () => {
    fetchJobApplications.mockResolvedValue([{ ...sampleApplication, resume: {} }]);
    fetchApplicationResumeBlobUrl.mockResolvedValue('blob:resume');
    URL.revokeObjectURL = jest.fn();

    render(<RecruiterDashboard onBack={() => {}} />);

    await screen.findByText('Backend Engineer');
    fireEvent.click(screen.getByText('View Applications'));
    await screen.findByText('Jane Doe');

    fireEvent.click(screen.getByText('Download Resume'));

    await waitFor(() =>
      expect(fetchApplicationResumeBlobUrl).toHaveBeenCalledWith('token', 'app-1', { download: true })
    );
  });

  it('shows an error when the resume download fails', async () => {
    fetchJobApplications.mockResolvedValue([sampleApplication]);
    fetchApplicationResumeBlobUrl.mockRejectedValue(new Error('Resume no longer available'));

    render(<RecruiterDashboard onBack={() => {}} />);

    await screen.findByText('Backend Engineer');
    fireEvent.click(screen.getByText('View Applications'));
    await screen.findByText('Jane Doe');

    fireEvent.click(screen.getByText('Download Resume'));

    expect(await screen.findByText('Resume no longer available')).toBeInTheDocument();
  });

  it('keeps the posting and shows an error when deletion fails', async () => {
    window.confirm = jest.fn(() => true);
    deleteJob.mockRejectedValue(new Error('Not authorized to delete this job'));

    render(<RecruiterDashboard onBack={() => {}} />);

    await screen.findByText('Backend Engineer');
    fireEvent.click(screen.getByText('Delete Posting'));

    expect(await screen.findByText('Not authorized to delete this job')).toBeInTheDocument();
    expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
  });

  it('cancels creating a posting and returns to the list', async () => {
    render(<RecruiterDashboard onBack={() => {}} />);

    await screen.findByText('Backend Engineer');
    fireEvent.click(screen.getByText('Post a New Job'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(await screen.findByText('Post a New Job')).toBeInTheDocument();
    expect(createJob).not.toHaveBeenCalled();
  });

  it('cancels editing a posting and returns to the list', async () => {
    render(<RecruiterDashboard onBack={() => {}} />);

    await screen.findByText('Backend Engineer');
    fireEvent.click(screen.getByText('Edit Posting'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(await screen.findByText('Post a New Job')).toBeInTheDocument();
    expect(updateJob).not.toHaveBeenCalled();
  });
});