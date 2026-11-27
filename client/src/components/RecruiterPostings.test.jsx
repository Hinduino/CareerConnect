// SCRUM-340 / SCRUM-384: Unit tests for the refactored RecruiterPostings component
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
    URL.revokeObjectURL = jest.fn();
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

    it('archives a posting, shows inline status feedback, and reloads the list', async () => {
      toggleArchiveJobPosting.mockResolvedValue({ message: 'Job posting archived successfully' });
      fetchRecruiterPostings
        .mockResolvedValueOnce([frontend, analyst])
        .mockResolvedValueOnce([{ ...frontend, isArchived: true }, analyst]);
      render(<RecruiterPostings />);
      await screen.findByText('Frontend Developer');

      fireEvent.click(within(rowFor('Frontend Developer')).getByText('Archive'));

      await waitFor(() => expect(toggleArchiveJobPosting).toHaveBeenCalledWith('token', 'job-fe'));
      expect(await screen.findByRole('status')).toHaveTextContent('Job posting archived successfully');
      await waitFor(() =>
        expect(within(rowFor('Frontend Developer')).getByText('Unarchive')).toBeInTheDocument()
      );
      expect(fetchApplicantsForJob).not.toHaveBeenCalled();
    });

    it('shows an inline alert banner when archiving fails and allows dismissing it', async () => {
      toggleArchiveJobPosting.mockRejectedValue(new Error('You can only archive your own job postings'));
      render(<RecruiterPostings />);
      await screen.findByText('Frontend Developer');

      fireEvent.click(within(rowFor('Frontend Developer')).getByText('Archive'));

      const alertBanner = await screen.findByRole('alert');
      expect(alertBanner).toHaveTextContent('You can only archive your own job postings');

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss message' }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
          dueDate: '',
        })
      );
      expect(await screen.findByRole('status')).toHaveTextContent('Job posting created successfully.');
      await waitFor(() => expect(screen.queryByText('Create New Job Posting')).not.toBeInTheDocument());
      expect(fetchRecruiterPostings).toHaveBeenCalledTimes(2);
    });

    it('marks Requirements as required in the posting form', async () => {
      render(<RecruiterPostings />);
      await screen.findByText('Frontend Developer');

      fireEvent.click(screen.getByText('+ Create New Job'));

      expect(formFields()[5]).toBeRequired();
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
      expect(await screen.findByRole('status')).toHaveTextContent('Job posting updated successfully.');
    });

    // SCRUM-373: Application Due Date (SCRUM-372) in the create/edit modal and the table
    describe('application due date', () => {
      const originalTz = process.env.TZ;
      const withDueDate = { ...frontend, dueDate: '2026-12-15T00:00:00.000Z' };

      afterEach(() => {
        process.env.TZ = originalTz;
      });

      function dueDateField() {
        return screen.getByLabelText('Application Due Date (Optional)');
      }

      it('shows the due date the recruiter picked, even in Toronto, and None when there is none', async () => {
        process.env.TZ = 'America/Toronto';
        fetchRecruiterPostings.mockResolvedValue([withDueDate, analyst]);
        const expected = new Date(Date.UTC(2026, 11, 15, 12)).toLocaleDateString(undefined, { timeZone: 'UTC' });

        render(<RecruiterPostings />);
        await screen.findByText('Frontend Developer');

        expect(within(rowFor('Frontend Developer')).getByText(expected)).toBeInTheDocument();
        expect(within(rowFor('Data Analyst')).getByText('None')).toBeInTheDocument();
      });

      it('sends the picked due date when creating a posting', async () => {
        createJobPosting.mockResolvedValue({});
        render(<RecruiterPostings />);
        await screen.findByText('Frontend Developer');

        fireEvent.click(screen.getByText('+ Create New Job'));
        expect(dueDateField()).toHaveAttribute('type', 'date');
        expect(dueDateField()).not.toBeRequired();
        const values = ['QA Tester', 'Acme Corp', 'Toronto', 'Engineering', 'Test the app.', 'Attention to detail'];
        formFields().forEach((field, i) => fireEvent.change(field, { target: { value: values[i] } }));
        fireEvent.change(dueDateField(), { target: { value: '2026-12-20' } });
        fireEvent.click(screen.getByText('Save'));

        await waitFor(() =>
          expect(createJobPosting).toHaveBeenCalledWith('token', expect.objectContaining({ dueDate: '2026-12-20' }))
        );
      });

      it('fills in the saved due date when editing and lets the recruiter clear it', async () => {
        process.env.TZ = 'America/Toronto';
        fetchRecruiterPostings.mockResolvedValue([withDueDate, analyst]);
        updateJobPosting.mockResolvedValue({});
        render(<RecruiterPostings />);
        await screen.findByText('Frontend Developer');

        fireEvent.click(within(rowFor('Frontend Developer')).getByText('Edit'));
        expect(dueDateField()).toHaveValue('2026-12-15');

        fireEvent.change(dueDateField(), { target: { value: '' } });
        fireEvent.click(screen.getByText('Save'));

        await waitFor(() =>
          expect(updateJobPosting).toHaveBeenCalledWith('token', 'job-fe', expect.objectContaining({ dueDate: '' }))
        );
      });

      it('opens Edit with an empty due date for a posting that has none', async () => {
        render(<RecruiterPostings />);
        await screen.findByText('Frontend Developer');

        fireEvent.click(within(rowFor('Frontend Developer')).getByText('Edit'));

        expect(dueDateField()).toHaveValue('');
      });
    });

    it('closes the form without saving on Cancel', async () => {
      render(<RecruiterPostings />);
      await screen.findByText('Frontend Developer');

      fireEvent.click(screen.getByText('+ Create New Job'));
      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.queryByText('Create New Job Posting')).not.toBeInTheDocument();
      expect(createJobPosting).not.toHaveBeenCalled();
    });

    it('shows an inline alert banner when saving fails', async () => {
      createJobPosting.mockRejectedValue(new Error('requirements is required'));
      render(<RecruiterPostings />);
      await screen.findByText('Frontend Developer');

      fireEvent.click(screen.getByText('+ Create New Job'));
      fireEvent.submit(screen.getByText('Save').closest('form'));

      expect(await screen.findByRole('alert')).toHaveTextContent('requirements is required');
      expect(screen.getByText('Create New Job Posting')).toBeInTheDocument();
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

      const sortSelect = screen.getByLabelText('Sort applicants by date');
      fireEvent.change(sortSelect, { target: { value: 'asc' } });

      expect(applicantNames()).toEqual(['Sara Test', 'Omar Lee']);
    });

    it('filters applicants by status and explains when none match', async () => {
      await openApplicants();
      const statusFilter = screen.getByLabelText('Filter applicants by status');

      fireEvent.change(statusFilter, { target: { value: 'Interview' } });
      expect(applicantNames()).toEqual(['Sara Test']);

      fireEvent.change(statusFilter, { target: { value: 'Offered' } });
      expect(screen.getByText('No applicants found matching criteria for this posting.')).toBeInTheDocument();
    });

    it('filters applicants by application date', async () => {
      await openApplicants();
      const dateInput = screen.getByLabelText('Filter applicants by application date');

      fireEvent.change(dateInput, { target: { value: '2026-11-08' } });
      expect(applicantNames()).toEqual(['Sara Test']);

      fireEvent.change(dateInput, { target: { value: '2026-11-25' } });
      expect(screen.getByText('No applicants found matching criteria for this posting.')).toBeInTheDocument();
    });

    it('updates an applicant status, shows status feedback, and reloads counts', async () => {
      updateApplicationStatus.mockResolvedValue({});
      await openApplicants();
      fetchApplicantsForJob.mockResolvedValue([
        frontendApplicants[0],
        { ...frontendApplicants[1], status: 'Under Review' },
      ]);

      const omarStatus = within(screen.getByText('Omar Lee').closest('tr')).getByRole('combobox');
      fireEvent.change(omarStatus, { target: { value: 'Under Review' } });

      await waitFor(() => expect(updateApplicationStatus).toHaveBeenCalledWith('token', 'app-2', 'Under Review', null));
      await waitFor(() => expect(omarStatus).toHaveValue('Under Review'));
      expect(await screen.findByRole('status')).toHaveTextContent('Applicant status updated to "Under Review".');
      expect(fetchRecruiterPostings).toHaveBeenCalledTimes(2);
    });

    it('shows "Offer Declined" for a declined offer instead of a different status', async () => {
      fetchApplicantsForJob.mockResolvedValue([applicant('app-3', 'Nina Park', 'Offer Declined', '2026-11-09T12:00:00.000Z')]);
      render(<RecruiterPostings />);
      fireEvent.click(await screen.findByText('Frontend Developer'));

      const ninaStatus = within((await screen.findByText('Nina Park')).closest('tr')).getByRole('combobox');
      expect(ninaStatus).toHaveValue('Offer Declined');
    });

    it('downloads the chosen applicant’s resume and revokes the object URL', async () => {
      fetchApplicationResumeBlobUrl.mockResolvedValue('blob:resume');
      await openApplicants();

      fireEvent.click(within(screen.getByText('Omar Lee').closest('tr')).getByText('Download'));

      await waitFor(() =>
        expect(fetchApplicationResumeBlobUrl).toHaveBeenCalledWith('token', 'app-2', { download: true })
      );
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:resume');
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