const { fireEvent, render, screen } = require('@testing-library/react');

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/applicationApi', () => ({
  applyToJob: jest.fn(),
  fetchMyApplications: jest.fn(),
}));

const JobDetail = require('./JobDetail').default;
const { useAuth } = require('../context/AuthContext');
const { applyToJob, fetchMyApplications } = require('../api/applicationApi');

const sampleJob = {
  _id: 'job-1',
  title: 'Backend Engineer',
  company: 'Acme Corp',
  location: 'Remote',
  category: 'Engineering',
  description: 'Build APIs.',
  requirements: '2+ years',
  createdAt: new Date().toISOString(),
};

const sampleApplication = {
  _id: 'app-1',
  job: { _id: 'job-1', title: 'Backend Engineer', company: 'Acme Corp' },
  status: 'Applied',
  statusHistory: [{ status: 'Applied', changedAt: '2026-10-14T14:00:00.000Z' }],
  createdAt: '2026-10-14T14:00:00.000Z',
};

const jobSeeker = { token: 'token', user: { role: 'job_seeker' }, isAuthenticated: true };

describe('JobDetail applying', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // JobDetail loads the job itself with fetch.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleJob,
    });
    useAuth.mockReturnValue(jobSeeker);
    fetchMyApplications.mockResolvedValue([]);
  });

  it('lets a job seeker apply and shows a confirmation with the status', async () => {
    applyToJob.mockResolvedValue(sampleApplication);
    render(<JobDetail jobId="job-1" onBack={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Apply Now' }));

    expect(await screen.findByText('Application submitted!')).toBeInTheDocument();
    expect(applyToJob).toHaveBeenCalledWith('token', 'job-1');
    expect(screen.getByRole('status')).toHaveTextContent('Current status: Applied');
    expect(screen.queryByRole('button', { name: 'Apply Now' })).not.toBeInTheDocument();
  });

  it('shows that the job seeker already applied instead of the Apply button', async () => {
    fetchMyApplications.mockResolvedValue([sampleApplication]);
    render(<JobDetail jobId="job-1" onBack={() => {}} />);

    expect(await screen.findByText('You have already applied')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply Now' })).not.toBeInTheDocument();
  });

  it('shows the existing application when the server says it was already submitted', async () => {
    const conflict = Object.assign(new Error('You have already applied to this job'), { status: 409 });
    applyToJob.mockRejectedValue(conflict);
    fetchMyApplications.mockResolvedValueOnce([]).mockResolvedValueOnce([sampleApplication]);
    render(<JobDetail jobId="job-1" onBack={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Apply Now' }));

    expect(await screen.findByText('You have already applied')).toBeInTheDocument();
  });

  it('shows an error and keeps the Apply button when submitting fails', async () => {
    applyToJob.mockRejectedValue(new Error('Server error submitting application'));
    render(<JobDetail jobId="job-1" onBack={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Apply Now' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Server error submitting application');
    expect(screen.getByRole('button', { name: 'Apply Now' })).toBeInTheDocument();
  });

  it('asks logged-out visitors to log in instead of showing the Apply button', async () => {
    useAuth.mockReturnValue({ token: null, user: null, isAuthenticated: false });
    render(<JobDetail jobId="job-1" onBack={() => {}} />);

    expect(await screen.findByText(/Log in as a job seeker to apply/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply Now' })).not.toBeInTheDocument();
    expect(fetchMyApplications).not.toHaveBeenCalled();
  });

  it('does not show the Apply button to recruiters', async () => {
    useAuth.mockReturnValue({ token: 'token', user: { role: 'recruiter' }, isAuthenticated: true });
    render(<JobDetail jobId="job-1" onBack={() => {}} />);

    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply Now' })).not.toBeInTheDocument();
  });
});