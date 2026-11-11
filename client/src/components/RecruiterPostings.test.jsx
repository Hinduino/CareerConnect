// SCRUM-278: Unit tests for the recruiter's Job Postings page
// (PR #52 – SCRUM-310 recruiter posting management: create, edit,
// archive, applicant counts, and the per-posting applicant drilldown).
const { fireEvent, render, screen, waitFor, within } = require('@testing-library/react');

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/jobManagementApi', () => ({
  fetchRecruiterPostings: jest.fn(),
  createJobPosting: jest.fn(),
  updateJobPosting: jest.fn(),
  toggleArchiveJobPosting: jest.fn(),
  fetchApplicantsForJob: jest.fn(),
}));
jest.mock('../api/applicationApi', () => ({
  updateApplicationStatus: jest.fn(),
  fetchApplicationResumeBlobUrl: jest.fn(),
}));

const RecruiterPostings = require('./RecruiterPostings').default;
const { useAuth } = require('../context/AuthContext');
const {
  fetchRecruiterPostings,
  createJobPosting,
  updateJobPosting,
  toggleArchiveJobPosting,
  fetchApplicantsForJob,
} = require('../api/jobManagementApi');
const { updateApplicationStatus, fetchApplicationResumeBlobUrl } = require('../api/applicationApi');

const frontend = {
  _id: 'job-fe',
  title: 'Frontend Developer',
  company: 'Acme Corp',
  location: 'Remote',
  category: 'Engineering',
  description: 'Build UIs.',
  requirements: 'React',
  applicantCount: 2,
  isArchived: false,
};
const analyst = {
  _id: 'job-da',
  title: 'Data Analyst',
  company: 'Acme Corp',
  location: 'Montreal',
  category: 'Data',
  description: 'Analyze data.',
  requirements: 'SQL',
  applicantCount: 0,
  isArchived: true,
};

function applicant(id, name, status, createdAt) {
  return { _id: id, status, createdAt, applicant: { name, email: `${id}@test.com` } };
}

const frontendApplicants = [
  applicant('app-1', 'Sara Test', 'Interview', '2026-11-08T12:00:00.000Z'),
  applicant('app-2', 'Omar Lee', 'Applied', '2026-11-09T12:00:00.000Z'),
];

function rowFor(title) {
  return screen.getByText(title).closest('tr');
}

// Form fields in order: title, company, location, category, description, requirements
function formFields() {
  return within(screen.getByRole('heading', { level: 3 }).closest('form')).getAllByRole('textbox');
}

async function openApplicants() {
  render(<RecruiterPostings />);
  fireEvent.click(await screen.findByText('Frontend Developer'));
  await screen.findByText('Omar Lee');
}

function applicantNames() {
  const table = screen.getByText('Candidate Name').closest('table');
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent);
}

describe('RecruiterPostings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ token: 'token' });
    window.alert = jest.fn();
    fetchRecruiterPostings.mockResolvedValue([frontend, analyst]);
    fetchApplicantsForJob.mockResolvedValue(frontendApplicants);
  });

  describe('postings table', () => {
    it("lists the recruiter's postings with applicant counts and status", async () => {
      render(<RecruiterPostings />);

      expect(await screen.findByText('Frontend Developer')).toBeInTheDocument();
      expect(fetchRecruiterPostings).toHaveBeenCalledWith('token');
      expect(within(rowFor('Frontend Developer')).getByText('2 received')).toBeInTheDocument();
      expect(within(rowFor('Frontend Developer')).getByText('Active')).toBeInTheDocument();
      expect(within(rowFor('Data Analyst')).getByText('0 received')).toBeInTheDocument();
      expect(within(rowFor('Data Analyst')).getByText('Archived')).toBeInTheDocument();
    });

    it('shows an empty state when the recruiter has no postings', async () => {
      fetchRecruiterPostings.mockResolvedValue([]);
      render(<RecruiterPostings />);

      expect(await screen.findByText("You haven't created any job postings yet.")).toBeInTheDocument();
    });

    it('shows the error when postings cannot be loaded', async () => {
      fetchRecruiterPostings.mockRejectedValue(new Error('Server error fetching your job postings'));
      render(<RecruiterPostings />);

      expect(await screen.findByText('Server error fetching your job postings')).toBeInTheDocument();
    });
  });

  describe('archive', () => {
    it('offers Archive on active postings and Unarchive on archived ones', async () => {
      render(<RecruiterPostings />);
      await screen.findByText('Frontend Developer');

      expect(within(rowFor('Frontend Developer')).getByText('Archive')).toBeInTheDocument();
      expect(within(rowFor('Data Analyst')).getByText('Unarchive')).toBeInTheDocument();
    });

    it('archives a posting and reloads the list', async () => {
      toggleArchiveJobPosting.mockResolvedValue({});
      fetchRecruiterPostings
        .mockResolvedValueOnce([frontend, analyst])
        .mockResolvedValueOnce([{ ...frontend, isArchived: true }, analyst]);
      render(<RecruiterPostings />);
      await screen.findByText('Frontend Developer');

      fireEvent.click(within(rowFor('Frontend Developer')).getByText('Archive'));

      await waitFor(() => expect(toggleArchiveJobPosting).toHaveBeenCalledWith('token', 'job-fe'));
      await waitFor(() =>
        expect(within(rowFor('Frontend Developer')).getByText('Unarchive')).toBeInTheDocument()
      );
      expect(fetchApplicantsForJob).not.toHaveBeenCalled(); // clicking Archive does not open the row
    });

    it('tells the recruiter when archiving fails', async () => {
      toggleArchiveJobPosting.mockRejectedValue(new Error('You can only archive your own job postings'));
      render(<RecruiterPostings />);
      await screen.findByText('Frontend Developer');

      fireEvent.click(within(rowFor('Frontend Developer')).getByText('Archive'));

      await waitFor(() =>
        expect(window.alert).toHaveBeenCalledWith('You can only archive your own job postings')
      );
    });
  });

  describe('create and edit', () => {
    it('creates a posting from the form and reloads the list', async () => {
      createJobPosting.mockResolvedValue({});
      render(<RecruiterPostings />);
      await screen.findByText('Frontend Developer');

      fireEvent.click(screen.getByText('+ Create New Job'));
      expect(screen.getByText('Create New Job Posting')).toBeInTheDocument();

      const values = ['QA Tester', 'Acme Corp', 'Toronto', 'Engineering', 'Test the app.', 'Attention to detail'];
      formFields().forEach((field, i) => fireEvent.change(field, { target: { value: values[i] } }));
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() =>
        expect(createJobPosting).toHaveBeenCalledWith('token', {
          title: 'QA Tester',
          company: 'Acme Corp',
          location: 'Toronto',
          category: 'Engineering',
          description: 'Test the app.',
          requirements: 'Attention to detail',
        })
      );
      await waitFor(() => expect(screen.queryByText('Create New Job Posting')).not.toBeInTheDocument());
      expect(fetchRecruiterPostings).toHaveBeenCalledTimes(2);
    });

    it('opens Edit with the posting filled in and saves the changes', async () => {
      updateJobPosting.mockResolvedValue({});
      render(<RecruiterPostings />);
      await screen.findByText('Frontend Developer');

      fireEvent.click(within(rowFor('Frontend Developer')).getByText('Edit'));

      expect(screen.getByText('Edit Job Posting')).toBeInTheDocument();
      expect(formFields().map((field) => field.value)).toEqual([
        'Frontend Developer',
        'Acme Corp',
        'Remote',
        'Engineering',
        'Build UIs.',
        'React',
      ]);

      fireEvent.change(formFields()[2], { target: { value: 'Hybrid' } });
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() =>
        expect(updateJobPosting).toHaveBeenCalledWith('token', 'job-fe', expect.objectContaining({ location: 'Hybrid' }))
      );
    });

    it('closes the form without saving on Cancel', async () => {
      render(<RecruiterPostings />);
      await screen.findByText('Frontend Developer');

      fireEvent.click(screen.getByText('+ Create New Job'));
      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.queryByText('Create New Job Posting')).not.toBeInTheDocument();
      expect(createJobPosting).not.toHaveBeenCalled();
    });

    it('tells the recruiter when saving fails', async () => {
      createJobPosting.mockRejectedValue(new Error('requirements is required'));
      render(<RecruiterPostings />);
      await screen.findByText('Frontend Developer');

      fireEvent.click(screen.getByText('+ Create New Job'));
      fireEvent.submit(screen.getByText('Save').closest('form'));

      await waitFor(() => expect(window.alert).toHaveBeenCalledWith('requirements is required'));
      expect(screen.getByText('Create New Job Posting')).toBeInTheDocument();
    });

    // Known bug: the form treats Requirements as optional, but the server
    // rejects postings without requirements, so saving fails with an alert.
    it.failing('KNOWN BUG: marks Requirements as required, like the server does', async () => {
      render(<RecruiterPostings />);
      await screen.findByText('Frontend Developer');

      fireEvent.click(screen.getByText('+ Create New Job'));

      expect(formFields()[5]).toBeRequired();
    });
  });

  describe('applicant drilldown', () => {
    it('shows the applicants when a posting is clicked, newest first', async () => {
      await openApplicants();

      expect(fetchApplicantsForJob).toHaveBeenCalledWith('token', 'job-fe');
      expect(screen.getByText('Applicants for: Frontend Developer')).toBeInTheDocument();
      expect(applicantNames()).toEqual(['Omar Lee', 'Sara Test']);
    });

    it('can sort oldest first', async () => {
      await openApplicants();

      const [, sortSelect] = within(screen.getByText('Applicants for: Frontend Developer').closest('div').parentElement)
        .getAllByRole('combobox');
      fireEvent.change(sortSelect, { target: { value: 'asc' } });

      expect(applicantNames()).toEqual(['Sara Test', 'Omar Lee']);
    });

    it('filters applicants by status and explains when none match', async () => {
      await openApplicants();
      const [statusFilter] = within(screen.getByText('Applicants for: Frontend Developer').closest('div').parentElement)
        .getAllByRole('combobox');

      fireEvent.change(statusFilter, { target: { value: 'Interview' } });
      expect(applicantNames()).toEqual(['Sara Test']);

      fireEvent.change(statusFilter, { target: { value: 'Offered' } });
      expect(screen.getByText('No applicants found matching criteria for this posting.')).toBeInTheDocument();
    });

    it('updates an applicant status, then reloads applicants and counts', async () => {
      updateApplicationStatus.mockResolvedValue({});
      await openApplicants();
      fetchApplicantsForJob.mockResolvedValue([
        frontendApplicants[0],
        { ...frontendApplicants[1], status: 'Under Review' },
      ]);

      const omarStatus = within(screen.getByText('Omar Lee').closest('tr')).getByRole('combobox');
      fireEvent.change(omarStatus, { target: { value: 'Under Review' } });

      await waitFor(() => expect(updateApplicationStatus).toHaveBeenCalledWith('token', 'app-2', 'Under Review'));
      await waitFor(() => expect(omarStatus).toHaveValue('Under Review'));
      expect(fetchRecruiterPostings).toHaveBeenCalledTimes(2);
    });

    it('shows "Offer Declined" for a declined offer instead of a different status', async () => {
      fetchApplicantsForJob.mockResolvedValue([applicant('app-3', 'Nina Park', 'Offer Declined', '2026-11-09T12:00:00.000Z')]);
      render(<RecruiterPostings />);
      fireEvent.click(await screen.findByText('Frontend Developer'));

      const ninaStatus = within((await screen.findByText('Nina Park')).closest('tr')).getByRole('combobox');
      expect(ninaStatus).toHaveValue('Offer Declined');
    });

    it('downloads the chosen applicant’s resume', async () => {
      fetchApplicationResumeBlobUrl.mockResolvedValue('blob:resume');
      await openApplicants();

      fireEvent.click(within(screen.getByText('Omar Lee').closest('tr')).getByText('Download'));

      await waitFor(() =>
        expect(fetchApplicationResumeBlobUrl).toHaveBeenCalledWith('token', 'app-2', { download: true })
      );
    });

    it('closes the drilldown when the open posting is archived', async () => {
      toggleArchiveJobPosting.mockResolvedValue({});
      await openApplicants();

      fireEvent.click(within(rowFor('Frontend Developer')).getByText('Archive'));

      await waitFor(() =>
        expect(screen.queryByText('Applicants for: Frontend Developer')).not.toBeInTheDocument()
      );
    });
  });
});