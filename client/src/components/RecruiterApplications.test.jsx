// SCRUM-278: Unit tests for the recruiter's centralized Applications page
// in RecruiterDashboard (PR #50 – SCRUM-315 status management,
// SCRUM-316 centralized dashboard, SCRUM-317 search and filtering).
const { fireEvent, render, screen, waitFor, within } = require('@testing-library/react');

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
  updateApplicationStatus: jest.fn(),
}));

const RecruiterDashboard = require('./RecruiterDashboard').default;
const { useAuth } = require('../context/AuthContext');
const { fetchMyJobs, fetchJobApplications } = require('../api/jobApi');
const { fetchApplicationResumeBlobUrl, updateApplicationStatus } = require('../api/applicationApi');

const now = new Date().toISOString();
const jobs = [
  { _id: 'job-fe', title: 'Frontend Developer', company: 'Acme Corp', createdAt: now, updatedAt: now },
  { _id: 'job-da', title: 'Data Analyst', company: 'Acme Corp', createdAt: now, updatedAt: now },
];

function application(id, name, email, status) {
  return {
    _id: id,
    status,
    createdAt: now,
    applicant: { name, email },
    resume: { originalName: `${id}.pdf` },
  };
}

const applicationsByJob = {
  'job-fe': [
    application('app-1', 'Sara Test', 'seeker1@test.com', 'Interview'),
    application('app-2', 'Omar Lee', 'omar@test.com', 'Applied'),
  ],
  'job-da': [application('app-3', 'Sara Test', 'seeker1@test.com', 'Rejected')],
};

function renderApplicationsPage(selectedApplicationId = null) {
  return render(
    <RecruiterDashboard
      currentView="recruiter-applications"
      selectedApplicationId={selectedApplicationId}
      onBack={() => {}}
    />
  );
}

// Each table row as "Applicant | Job Title"
function visibleRows() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => {
      const cells = within(row).getAllByRole('cell');
      return `${cells[0].textContent} | ${cells[1].textContent}`;
    });
}

function search(text) {
  fireEvent.change(screen.getByLabelText('Search applications'), { target: { value: text } });
}

function filterByStatus(status) {
  fireEvent.change(screen.getByLabelText('Filter by application status'), { target: { value: status } });
}

describe('Recruiter Applications page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ token: 'token' });
    fetchMyJobs.mockResolvedValue(jobs);
    fetchJobApplications.mockImplementation(async (_token, jobId) => applicationsByJob[jobId]);
  });

  it("collects the applications from all of the recruiter's postings in one table", async () => {
    renderApplicationsPage();

    expect(await screen.findByText('Omar Lee')).toBeInTheDocument();
    expect(fetchJobApplications).toHaveBeenCalledWith('token', 'job-fe');
    expect(fetchJobApplications).toHaveBeenCalledWith('token', 'job-da');
    expect(visibleRows()).toEqual([
      'Sara Test | Frontend Developer',
      'Omar Lee | Frontend Developer',
      'Sara Test | Data Analyst',
    ]);
  });

  it('scrolls to and highlights the application opened from a notification', async () => {
    renderApplicationsPage('app-3');

    await waitFor(() => {
      expect(document.getElementById('recruiter-application-app-3')).toHaveAttribute(
        'aria-current',
        'true'
      );
    });

    const applicationRow = document.getElementById('recruiter-application-app-3');
    expect(applicationRow).toHaveStyle({ backgroundColor: 'rgb(238, 242, 255)' });
  });

  it('shows an empty message when there are no applications yet', async () => {
    fetchJobApplications.mockResolvedValue([]);
    renderApplicationsPage();

    expect(await screen.findByText('No applications received yet.')).toBeInTheDocument();
  });

  it('shows an error when the applications cannot be loaded', async () => {
    fetchJobApplications.mockRejectedValue(new Error('Server error fetching applications'));
    renderApplicationsPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Server error fetching applications');
  });

  it('falls back to "Applicant" when the applicant has no name', async () => {
    fetchMyJobs.mockResolvedValue([jobs[0]]);
    fetchJobApplications.mockResolvedValue([application('app-9', '', 'noname@test.com', 'Applied')]);
    renderApplicationsPage();

    expect(await screen.findByText('noname@test.com')).toBeInTheDocument();
    expect(visibleRows()).toEqual(['Applicant | Frontend Developer']);
  });

  describe('search (SCRUM-317)', () => {
    it.each([
      ['applicant name', 'Sara', ['Sara Test | Frontend Developer', 'Sara Test | Data Analyst']],
      ['email', 'omar@test.com', ['Omar Lee | Frontend Developer']],
      ['job title', 'Data', ['Sara Test | Data Analyst']],
      ['any capitalization', 'FRONTEND', ['Sara Test | Frontend Developer', 'Omar Lee | Frontend Developer']],
      ['part of a word', 'eker1', ['Sara Test | Frontend Developer', 'Sara Test | Data Analyst']],
    ])('matches on %s', async (_label, text, expected) => {
      renderApplicationsPage();
      await screen.findByText('Omar Lee');

      search(text);

      expect(visibleRows()).toEqual(expected);
    });

    it('does not crash on special characters', async () => {
      renderApplicationsPage();
      await screen.findByText('Omar Lee');

      search('(.*[');

      expect(screen.getByLabelText('Search applications')).toHaveValue('(.*[');
      expect(screen.queryAllByRole('row')).toHaveLength(1); // header only
    });

    it('shows everything again when the search is cleared', async () => {
      renderApplicationsPage();
      await screen.findByText('Omar Lee');

      search('Omar');
      search('');

      expect(visibleRows()).toHaveLength(3);
    });

    // Known bug: when nothing matches, the table is left with only its
    // headers instead of telling the recruiter there are no results.
    it.failing('KNOWN BUG: tells the recruiter when no applications match the search', async () => {
      renderApplicationsPage();
      await screen.findByText('Omar Lee');

      search('zzzz');

      expect(screen.getByText(/no (applications|results)/i)).toBeInTheDocument();
    });
  });

  describe('status filter (SCRUM-317)', () => {
    it('shows only applications with the chosen status', async () => {
      renderApplicationsPage();
      await screen.findByText('Omar Lee');

      filterByStatus('Rejected');
      expect(visibleRows()).toEqual(['Sara Test | Data Analyst']);

      filterByStatus('All');
      expect(visibleRows()).toHaveLength(3);
    });

    it('combines with the search', async () => {
      renderApplicationsPage();
      await screen.findByText('Omar Lee');

      search('Sara');
      filterByStatus('Interview');

      expect(visibleRows()).toEqual(['Sara Test | Frontend Developer']);
    });
  });

  describe('status management (SCRUM-315)', () => {
    it('sends the new status to the API and shows the saved status', async () => {
      updateApplicationStatus.mockResolvedValue({ application: { _id: 'app-2', status: 'Under Review' } });
      renderApplicationsPage();
      await screen.findByText('Omar Lee');

      const select = screen.getByLabelText('Application status for Omar Lee');
      fireEvent.change(select, { target: { value: 'Under Review' } });

      await waitFor(() => expect(select).toHaveValue('Under Review'));
      expect(updateApplicationStatus).toHaveBeenCalledWith('token', 'app-2', 'Under Review');
    });

    it('offers exactly the five recruiter statuses', async () => {
      renderApplicationsPage();
      await screen.findByText('Omar Lee');

      const options = within(screen.getByLabelText('Application status for Omar Lee'))
        .getAllByRole('option')
        .map((option) => option.value);

      expect(options).toEqual(['Applied', 'Under Review', 'Interview', 'Offered', 'Rejected']);
    });

    it('updated statuses are picked up by the status filter', async () => {
      updateApplicationStatus.mockResolvedValue({ application: { _id: 'app-2', status: 'Offered' } });
      renderApplicationsPage();
      await screen.findByText('Omar Lee');

      fireEvent.change(screen.getByLabelText('Application status for Omar Lee'), {
        target: { value: 'Offered' },
      });
      await waitFor(() => expect(updateApplicationStatus).toHaveBeenCalled());
      filterByStatus('Offered');

      await waitFor(() => expect(visibleRows()).toEqual(['Omar Lee | Frontend Developer']));
    });

    it('keeps the old status if the update fails', async () => {
      updateApplicationStatus.mockRejectedValue(new Error('Not authorized to update this application.'));
      renderApplicationsPage();
      await screen.findByText('Omar Lee');

      const select = screen.getByLabelText('Application status for Omar Lee');
      fireEvent.change(select, { target: { value: 'Rejected' } });

      await waitFor(() => expect(updateApplicationStatus).toHaveBeenCalled());
      expect(select).toHaveValue('Applied');
    });

    // Known bug: on this page a failed update is silently reverted. The
    // error is stored, but only displayed on the per-posting view.
    it.failing('KNOWN BUG: shows an error message when a status update fails', async () => {
      updateApplicationStatus.mockRejectedValue(new Error('Not authorized to update this application.'));
      renderApplicationsPage();
      await screen.findByText('Omar Lee');

      fireEvent.change(screen.getByLabelText('Application status for Omar Lee'), {
        target: { value: 'Rejected' },
      });

      expect(await screen.findByText('Not authorized to update this application.')).toBeInTheDocument();
    });

    // Known bug: PR #51 lets candidates decline offers, but the recruiter's
    // status menu has no "Offer Declined" option, so the dropdown falls
    // back to showing "Applied" for a declined offer.
    it.failing('KNOWN BUG: shows "Offer Declined" to the recruiter instead of "Applied"', async () => {
      fetchMyJobs.mockResolvedValue([jobs[0]]);
      fetchJobApplications.mockResolvedValue([
        application('app-5', 'Nina Park', 'nina@test.com', 'Offer Declined'),
      ]);
      renderApplicationsPage();
      await screen.findByText('Nina Park');

      expect(screen.getByLabelText('Application status for Nina Park')).toHaveValue('Offer Declined');
    });
  });

  it('downloads the resume for the chosen application (SCRUM-316)', async () => {
    fetchApplicationResumeBlobUrl.mockResolvedValue('blob:resume');
    URL.revokeObjectURL = jest.fn();
    renderApplicationsPage();
    await screen.findByText('Omar Lee');

    const omarRow = screen.getByText('Omar Lee').closest('tr');
    fireEvent.click(within(omarRow).getByText('Download Resume'));

    await waitFor(() =>
      expect(fetchApplicationResumeBlobUrl).toHaveBeenCalledWith('token', 'app-2', { download: true })
    );
  });
});