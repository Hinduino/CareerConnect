// SCRUM-278: Unit tests for the job seeker's My Applications page
// (PR #50 – SCRUM-277 status tracking and statistics, SCRUM-314 redesign).
const { fireEvent, render, screen, within } = require('@testing-library/react');

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/applicationApi', () => ({ fetchMyApplications: jest.fn() }));

const MyApplications = require('./MyApplications').default;
const { useAuth } = require('../context/AuthContext');
const { fetchMyApplications } = require('../api/applicationApi');

function application(id, title, status, company = 'Acme Corp') {
  return {
    _id: id,
    status,
    createdAt: '2026-11-09T12:00:00.000Z',
    job: { title, company },
  };
}

const sampleApplications = [
  application('a1', 'Frontend Developer', 'Interview'),
  application('a2', 'Data Analyst', 'Rejected'),
  application('a3', 'Backend Developer', 'Applied', 'Globex'),
  application('a4', 'QA Tester', 'Applied'),
];

function filterButton(name) {
  return screen.getByRole('button', { name: new RegExp(`^${name} \\(`) });
}

function visibleJobTitles() {
  const rows = screen.getAllByRole('row').slice(1); // skip header row
  return rows.map((row) => within(row).getAllByRole('cell')[0].textContent);
}

describe('MyApplications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ token: 'token' });
  });

  it('loads the applications with the user token and lists each one', async () => {
    fetchMyApplications.mockResolvedValue(sampleApplications);
    render(<MyApplications />);

    expect(await screen.findByText('Frontend Developer')).toBeInTheDocument();
    expect(fetchMyApplications).toHaveBeenCalledWith('token');
    expect(visibleJobTitles()).toEqual([
      'Frontend Developer',
      'Data Analyst',
      'Backend Developer',
      'QA Tester',
    ]);
    expect(screen.getByText('Globex')).toBeInTheDocument();
  });

  it('shows a count for every status that matches the data', async () => {
    fetchMyApplications.mockResolvedValue(sampleApplications);
    render(<MyApplications />);
    await screen.findByText('Frontend Developer');

    expect(filterButton('All')).toHaveTextContent('All (4)');
    expect(filterButton('Applied')).toHaveTextContent('Applied (2)');
    expect(filterButton('Under Review')).toHaveTextContent('Under Review (0)');
    expect(filterButton('Interview')).toHaveTextContent('Interview (1)');
    expect(filterButton('Offered')).toHaveTextContent('Offered (0)');
    expect(filterButton('Rejected')).toHaveTextContent('Rejected (1)');
  });

  it('filters the table by status and marks the active filter', async () => {
    fetchMyApplications.mockResolvedValue(sampleApplications);
    render(<MyApplications />);
    await screen.findByText('Frontend Developer');

    fireEvent.click(filterButton('Applied'));
    expect(visibleJobTitles()).toEqual(['Backend Developer', 'QA Tester']);
    expect(filterButton('Applied')).toHaveAttribute('aria-pressed', 'true');
    expect(filterButton('All')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(filterButton('Rejected'));
    expect(visibleJobTitles()).toEqual(['Data Analyst']);

    fireEvent.click(filterButton('All'));
    expect(visibleJobTitles()).toHaveLength(4);
  });

  it('explains when a filter has no matches', async () => {
    fetchMyApplications.mockResolvedValue(sampleApplications);
    render(<MyApplications />);
    await screen.findByText('Frontend Developer');

    fireEvent.click(filterButton('Offered'));

    expect(screen.getByText('No applications found with the "Offered" status.')).toBeInTheDocument();
  });

  it('shows an empty state with zero counts when there are no applications', async () => {
    fetchMyApplications.mockResolvedValue([]);
    render(<MyApplications />);

    expect(await screen.findByText("You haven't applied to any jobs yet.")).toBeInTheDocument();
    expect(filterButton('All')).toHaveTextContent('All (0)');
    expect(filterButton('Rejected')).toHaveTextContent('Rejected (0)');
  });

  it('shows the error message when loading fails', async () => {
    fetchMyApplications.mockRejectedValue(new Error('Server error fetching your applications'));
    render(<MyApplications />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Server error fetching your applications');
  });

  it('shows a placeholder when a job posting has been deleted', async () => {
    fetchMyApplications.mockResolvedValue([{ ...application('a1', '', 'Applied'), job: null }]);
    render(<MyApplications />);

    expect(await screen.findByText('Job unavailable')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  // Known bug: PR #51 added "Offer Declined", but this page only knows the
  // five statuses from PR #50, so a declined offer has no filter button and
  // the status counts no longer add up to the total.
  it.failing('KNOWN BUG: gives "Offer Declined" its own filter so the counts add up to All', async () => {
    fetchMyApplications.mockResolvedValue([
      ...sampleApplications,
      application('a5', 'Designer', 'Offer Declined'),
    ]);
    render(<MyApplications />);
    await screen.findByText('Designer');

    expect(filterButton('Offer Declined')).toHaveTextContent('Offer Declined (1)');
  });
});