const { fireEvent, render, screen, within } = require('@testing-library/react');

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/applicationApi', () => ({
  fetchMyApplications: jest.fn(),
}));

const MyApplications = require('./MyApplications').default;
const { useAuth } = require('../context/AuthContext');
const { fetchMyApplications } = require('../api/applicationApi');

const interviewApplication = {
  _id: 'app-1',
  job: { _id: 'job-1', title: 'Backend Engineer', company: 'Acme Corp', location: 'Remote' },
  status: 'Interview',
  statusHistory: [
    { status: 'Applied', changedAt: '2026-10-10T14:00:00.000Z' },
    { status: 'Under Review', changedAt: '2026-10-11T14:00:00.000Z' },
    { status: 'Interview', changedAt: '2026-10-12T14:00:00.000Z' },
  ],
  createdAt: '2026-10-10T14:00:00.000Z',
};

const appliedApplication = {
  _id: 'app-2',
  job: { _id: 'job-2', title: 'Product Designer', company: 'Globex', location: 'Montreal' },
  status: 'Applied',
  statusHistory: [{ status: 'Applied', changedAt: '2026-10-13T14:00:00.000Z' }],
  createdAt: '2026-10-13T14:00:00.000Z',
};

describe('MyApplications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ token: 'token' });
  });

  it('lists each application with its job and current status', async () => {
    fetchMyApplications.mockResolvedValue([interviewApplication, appliedApplication]);
    render(<MyApplications onBrowseJobs={() => {}} />);

    const first = (await screen.findByText('Backend Engineer')).closest('li');
    expect(within(first).getByText('Acme Corp · Remote')).toBeInTheDocument();
    expect(within(first).getAllByText('Interview')[0]).toHaveClass('status-badge');

    const second = screen.getByText('Product Designer').closest('li');
    expect(within(second).getAllByText('Applied')[0]).toHaveClass('status-applied');
    expect(fetchMyApplications).toHaveBeenCalledWith('token');
  });

  it('shows the status history so updates over time are visible', async () => {
    fetchMyApplications.mockResolvedValue([interviewApplication]);
    const { container } = render(<MyApplications onBrowseJobs={() => {}} />);

    await screen.findByText('Backend Engineer');
    expect(screen.getByText('Status history (3)')).toBeInTheDocument();

    const steps = Array.from(container.querySelectorAll('.status-history li'));
    expect(steps.map((step) => step.querySelector('.status-badge').textContent))
      .toEqual(['Applied', 'Under Review', 'Interview']);
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();
  });

  it('shows an empty state with a way to browse jobs', async () => {
    fetchMyApplications.mockResolvedValue([]);
    const onBrowseJobs = jest.fn();
    render(<MyApplications onBrowseJobs={onBrowseJobs} />);

    expect(await screen.findByText(/haven't applied to any jobs yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Browse Jobs' }));
    expect(onBrowseJobs).toHaveBeenCalled();
  });

  it('shows an error when the applications cannot be loaded', async () => {
    fetchMyApplications.mockRejectedValue(new Error('Failed to load your applications'));
    render(<MyApplications onBrowseJobs={() => {}} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load your applications');
  });

  it('loads the latest statuses again when Refresh is clicked', async () => {
    fetchMyApplications
      .mockResolvedValueOnce([appliedApplication])
      .mockResolvedValueOnce([{ ...appliedApplication, status: 'Under Review' }]);
    render(<MyApplications onBrowseJobs={() => {}} />);

    await screen.findByText('Product Designer');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    const card = (await screen.findByText('Under Review')).closest('li');
    expect(card).toHaveTextContent('Product Designer');
    expect(fetchMyApplications).toHaveBeenCalledTimes(2);
  });

  it('handles an application whose job posting was deleted', async () => {
    fetchMyApplications.mockResolvedValue([{ ...appliedApplication, job: null }]);
    render(<MyApplications onBrowseJobs={() => {}} />);

    expect(await screen.findByText('Job no longer available')).toBeInTheDocument();
  });
});