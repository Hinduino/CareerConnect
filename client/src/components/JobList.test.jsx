// SCRUM-366: Unit tests for the Find Jobs page (SCRUM-365): search and
// filters, category options, deadlines, and the empty and error states.
const { fireEvent, render, screen, waitFor, within } = require('@testing-library/react');

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/favoriteApi', () => ({
  fetchFavoriteJobIds: jest.fn(),
  toggleFavoriteJob: jest.fn(),
}));

const JobList = require('./JobList').default;
const { useAuth } = require('../context/AuthContext');
const { fetchFavoriteJobIds, toggleFavoriteJob } = require('../api/favoriteApi');

const now = new Date().toISOString();
const jobs = [
  { _id: 'job-1', title: 'Frontend Developer', company: 'Acme', location: 'Montreal', category: 'Engineering', createdAt: now, dueDate: '2026-12-20T12:00:00.000Z' },
  { _id: 'job-2', title: 'Data Analyst', company: 'Globex', location: 'Remote', category: 'Data Science', createdAt: now, dueDate: null },
  { _id: 'job-3', title: 'Platform Engineer', company: 'Initech', location: 'Toronto', category: 'Software Engineering', createdAt: now },
];

function respondWith(data, ok = true) {
  return Promise.resolve({ ok, json: async () => data });
}

// The query string of the n-th request made to /api/jobs
function requestedFilters(callIndex) {
  const url = new URL(global.fetch.mock.calls[callIndex][0]);
  return Object.fromEntries(url.searchParams.entries());
}

function jobTitles() {
  return screen.queryAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
}

async function renderPage() {
  const onViewDetails = jest.fn();
  render(<JobList onViewDetails={onViewDetails} />);
  await screen.findByText('Frontend Developer');
  return onViewDetails;
}

describe('JobList (Find Jobs)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ isAuthenticated: false, user: null, token: null });
    global.fetch = jest.fn(() => respondWith(jobs));
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('listing', () => {
    it('loads every open posting with no filters', async () => {
      await renderPage();

      expect(requestedFilters(0)).toEqual({ keyword: '', location: '', category: '' });
      expect(jobTitles()).toEqual(['Frontend Developer', 'Data Analyst', 'Platform Engineer']);
    });

    it('shows the application deadline when a posting has one', async () => {
      await renderPage();

      const frontendCard = screen.getByText('Frontend Developer').closest('div').parentElement;
      expect(within(frontendCard).getByText(`Apply by ${new Date(jobs[0].dueDate).toLocaleDateString()}`)).toBeInTheDocument();
      expect(screen.getAllByText(/^Apply by /)).toHaveLength(1);
    });

    it('opens the job details', async () => {
      const onViewDetails = await renderPage();

      fireEvent.click(screen.getAllByRole('button', { name: 'View Details' })[1]);

      expect(onViewDetails).toHaveBeenCalledWith('job-2');
    });

    it('says when there are no open postings at all', async () => {
      global.fetch = jest.fn(() => respondWith([]));
      render(<JobList onViewDetails={jest.fn()} />);

      expect(await screen.findByText('There are no open job postings right now.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    });

    it('shows an error when the jobs cannot be loaded', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
      render(<JobList onViewDetails={jest.fn()} />);

      expect(await screen.findByText('Failed to load jobs. Please check your connection.')).toBeInTheDocument();
    });
  });

  describe('category options', () => {
    it('offers the default categories plus every category used by a posting, sorted', async () => {
      await renderPage();

      const options = within(screen.getByLabelText('Category')).getAllByRole('option').map((o) => o.textContent);
      expect(options).toEqual([
        'All Categories',
        'Data Science',
        'Design',
        'Engineering',
        'Marketing',
        'Software Engineering',
      ]);
    });

    it('keeps the default categories when there are no postings', async () => {
      global.fetch = jest.fn(() => respondWith([]));
      render(<JobList onViewDetails={jest.fn()} />);
      await screen.findByText('There are no open job postings right now.');

      const options = within(screen.getByLabelText('Category')).getAllByRole('option').map((o) => o.textContent);
      expect(options).toEqual(['All Categories', 'Design', 'Engineering', 'Marketing']);
    });
  });

  describe('search and filters', () => {
    it('sends the keyword, location and category to the server', async () => {
      await renderPage();
      global.fetch.mockImplementation(() => respondWith([jobs[2]]));

      fireEvent.change(screen.getByLabelText('Keyword'), { target: { value: 'engineer' } });
      fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Toronto' } });
      fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Software Engineering' } });
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));

      await waitFor(() => expect(jobTitles()).toEqual(['Platform Engineer']));
      expect(requestedFilters(1)).toEqual({ keyword: 'engineer', location: 'Toronto', category: 'Software Engineering' });
    });

    it('explains when a search has no results and clears the filters on request', async () => {
      await renderPage();
      global.fetch.mockImplementationOnce(() => respondWith([]));

      fireEvent.change(screen.getByLabelText('Keyword'), { target: { value: 'zzzz' } });
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));

      expect(await screen.findByText('No jobs match your search. Try different keywords or filters.')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

      await waitFor(() => expect(jobTitles()).toHaveLength(3));
      expect(screen.getByLabelText('Keyword')).toHaveValue('');
      expect(screen.getByLabelText('Location')).toHaveValue('');
      expect(screen.getByLabelText('Category')).toHaveValue('');
      expect(requestedFilters(2)).toEqual({ keyword: '', location: '', category: '' });
    });

    it('does not offer "Clear filters" after searching with empty filters', async () => {
      await renderPage();
      global.fetch.mockImplementationOnce(() => respondWith([]));

      fireEvent.click(screen.getByRole('button', { name: 'Search' }));

      expect(await screen.findByText('There are no open job postings right now.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    });

    it('sends special characters to the server as typed', async () => {
      await renderPage();
      global.fetch.mockImplementationOnce(() => respondWith([]));

      fireEvent.change(screen.getByLabelText('Keyword'), { target: { value: 'C++ (Senior)' } });
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));

      await screen.findByText('No jobs match your search. Try different keywords or filters.');
      expect(requestedFilters(1).keyword).toBe('C++ (Senior)');
    });

    it('shows an error when a search fails', async () => {
      await renderPage();
      global.fetch.mockImplementationOnce(() => respondWith({ error: 'Server error fetching jobs' }, false));

      fireEvent.click(screen.getByRole('button', { name: 'Search' }));

      expect(await screen.findByText('Failed to fetch jobs. Please try again later.')).toBeInTheDocument();
    });
  });

  describe('saving jobs', () => {
    it('lets a job seeker save a job', async () => {
      useAuth.mockReturnValue({ isAuthenticated: true, user: { role: 'job_seeker' }, token: 'token' });
      fetchFavoriteJobIds.mockResolvedValue([]);
      toggleFavoriteJob.mockResolvedValue({ savedJobIds: ['job-1'] });
      await renderPage();

      fireEvent.click(screen.getAllByRole('button', { name: '☆ Save Job' })[0]);

      await waitFor(() => expect(screen.getByRole('button', { name: '★ Saved' })).toBeInTheDocument());
      expect(toggleFavoriteJob).toHaveBeenCalledWith('token', 'job-1');
    });

    it('does not show save buttons to visitors or recruiters', async () => {
      useAuth.mockReturnValue({ isAuthenticated: true, user: { role: 'recruiter' }, token: 'token' });
      await renderPage();

      expect(screen.queryByRole('button', { name: '☆ Save Job' })).not.toBeInTheDocument();
      expect(fetchFavoriteJobIds).not.toHaveBeenCalled();
    });
  });
});