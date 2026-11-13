// SCRUM-278: Unit tests for the job seeker's application history page
// (PR #51 – SCRUM-309 history, withdraw, decline offer; PR #52 – SCRUM-318
// analytics shown above the table). This is the page the "My Applications"
// menu opens on main.
const { fireEvent, render, screen, waitFor, within } = require('@testing-library/react');

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/applicationApi', () => ({
  fetchMyApplications: jest.fn(),
  cancelApplication: jest.fn(),
  declineJobOffer: jest.fn(),
}));

const ApplicationHistory = require('./ApplicationHistory').default;
const { useAuth } = require('../context/AuthContext');
const { fetchMyApplications, cancelApplication, declineJobOffer } = require('../api/applicationApi');

function application(id, title, status, extra = {}) {
  return {
    _id: id,
    status,
    createdAt: '2026-11-09T12:00:00.000Z',
    job: { title, company: 'Acme Corp', location: 'Montreal', description: `About the ${title} role` },
    ...extra,
  };
}

const sampleApplications = [
  application('a1', 'Frontend Developer', 'Offered'),
  application('a2', 'Data Analyst', 'Applied'),
  application('a3', 'Backend Developer', 'Rejected'),
  application('a4', 'Designer', 'Offer Declined'),
];

function rowFor(title) {
  return screen.getByText(title).closest('tr');
}

describe('ApplicationHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ user: { role: 'job_seeker' }, token: 'token' });
    window.confirm = jest.fn(() => true);
    window.alert = jest.fn();
  });

  it('lists every application with its company, status and total', async () => {
    fetchMyApplications.mockResolvedValue(sampleApplications);
    render(<ApplicationHistory />);

    expect(await screen.findByText('Frontend Developer')).toBeInTheDocument();
    expect(fetchMyApplications).toHaveBeenCalledWith('token');
    expect(within(rowFor('Data Analyst')).getByText('Applied')).toBeInTheDocument();
    expect(within(rowFor('Designer')).getByText('Offer Declined')).toBeInTheDocument();
    expect(screen.getByText(/Total Submitted:/)).toHaveTextContent('Total Submitted: 4');
  });

  it('shows the analytics panel above the table when there are applications (SCRUM-318)', async () => {
    fetchMyApplications.mockResolvedValue(sampleApplications);
    render(<ApplicationHistory />);
    await screen.findByText('Frontend Developer');

    expect(screen.getByText('Total Applications')).toBeInTheDocument();
    expect(screen.getByText('Application Status Breakdown')).toBeInTheDocument();
  });

  it('shows an empty state and no analytics when there are no applications', async () => {
    fetchMyApplications.mockResolvedValue([]);
    render(<ApplicationHistory />);

    expect(await screen.findByText('No applications found')).toBeInTheDocument();
    expect(screen.queryByText('Total Applications')).not.toBeInTheDocument();
  });

  it('shows the error message when loading fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMyApplications.mockRejectedValue(new Error('Server error fetching your applications'));
    render(<ApplicationHistory />);

    expect(await screen.findByText('Server error fetching your applications')).toBeInTheDocument();
    console.error.mockRestore();
  });

  describe('withdraw (SCRUM-309)', () => {
    it.each([
      ['Applied', true],
      ['Under Review', true],
      ['Interview', true],
      ['Offered', true],
      ['Rejected', false],
      ['Offer Declined', false],
      ['Cancelled', false],
    ])('a "%s" application shows Withdraw: %s', async (status, shown) => {
      fetchMyApplications.mockResolvedValue([application('a1', 'Frontend Developer', status)]);
      render(<ApplicationHistory />);
      await screen.findByText('Frontend Developer');

      const button = within(rowFor('Frontend Developer')).queryByText('Withdraw');
      if (shown) {
        expect(button).toBeInTheDocument();
      } else {
        expect(button).not.toBeInTheDocument();
      }
    });

    it('asks for confirmation, withdraws, and reloads the list', async () => {
      fetchMyApplications
        .mockResolvedValueOnce(sampleApplications)
        .mockResolvedValueOnce(sampleApplications.filter((a) => a._id !== 'a2'));
      cancelApplication.mockResolvedValue({});
      render(<ApplicationHistory />);
      await screen.findByText('Data Analyst');

      fireEvent.click(within(rowFor('Data Analyst')).getByText('Withdraw'));

      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to withdraw this application?');
      await waitFor(() => expect(cancelApplication).toHaveBeenCalledWith('token', 'a2'));
      await waitFor(() => expect(screen.queryByText('Data Analyst')).not.toBeInTheDocument());
      expect(fetchMyApplications).toHaveBeenCalledTimes(2);
    });

    it('does nothing if the seeker cancels the confirmation', async () => {
      window.confirm = jest.fn(() => false);
      fetchMyApplications.mockResolvedValue(sampleApplications);
      render(<ApplicationHistory />);
      await screen.findByText('Data Analyst');

      fireEvent.click(within(rowFor('Data Analyst')).getByText('Withdraw'));

      expect(cancelApplication).not.toHaveBeenCalled();
    });

    it('tells the seeker when withdrawing fails', async () => {
      fetchMyApplications.mockResolvedValue(sampleApplications);
      cancelApplication.mockRejectedValue(new Error('Application not found.'));
      render(<ApplicationHistory />);
      await screen.findByText('Data Analyst');

      fireEvent.click(within(rowFor('Data Analyst')).getByText('Withdraw'));

      await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Application not found.'));
    });
  });

  describe('decline offer (SCRUM-309)', () => {
    it('only shows Decline Offer on offered applications', async () => {
      fetchMyApplications.mockResolvedValue(sampleApplications);
      render(<ApplicationHistory />);
      await screen.findByText('Frontend Developer');

      expect(screen.getAllByText('Decline Offer')).toHaveLength(1);
      expect(within(rowFor('Frontend Developer')).getByText('Decline Offer')).toBeInTheDocument();
    });

    it('asks for confirmation, declines, and shows the new status after reloading', async () => {
      fetchMyApplications
        .mockResolvedValueOnce(sampleApplications)
        .mockResolvedValueOnce([
          application('a1', 'Frontend Developer', 'Offer Declined'),
          ...sampleApplications.slice(1),
        ]);
      declineJobOffer.mockResolvedValue({});
      render(<ApplicationHistory />);
      await screen.findByText('Frontend Developer');

      fireEvent.click(screen.getByText('Decline Offer'));

      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to decline this job offer?');
      await waitFor(() => expect(declineJobOffer).toHaveBeenCalledWith('token', 'a1'));
      await waitFor(() => expect(screen.queryByText('Decline Offer')).not.toBeInTheDocument());
      expect(within(rowFor('Frontend Developer')).getByText('Offer Declined')).toBeInTheDocument();
    });

    it('tells the seeker when declining fails', async () => {
      fetchMyApplications.mockResolvedValue(sampleApplications);
      declineJobOffer.mockRejectedValue(new Error('Cannot decline an offer unless one has been extended.'));
      render(<ApplicationHistory />);
      await screen.findByText('Frontend Developer');

      fireEvent.click(screen.getByText('Decline Offer'));

      await waitFor(() =>
        expect(window.alert).toHaveBeenCalledWith('Cannot decline an offer unless one has been extended.')
      );
    });
  });

  it('opens the details when a row is clicked and closes them again', async () => {
    fetchMyApplications.mockResolvedValue(sampleApplications);
    render(<ApplicationHistory />);
    await screen.findByText('Data Analyst');

    fireEvent.click(rowFor('Data Analyst'));

    expect(screen.getByRole('heading', { name: 'Data Analyst' })).toBeInTheDocument();
    expect(screen.getByText('Acme Corp • Montreal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByRole('heading', { name: 'Data Analyst' })).not.toBeInTheDocument();
  });

  it('opens the application targeted by a notification', async () => {
    fetchMyApplications.mockResolvedValue(sampleApplications);
    render(<ApplicationHistory selectedApplicationId="a2" />);

    expect(await screen.findAllByText('Data Analyst')).toHaveLength(2);

    expect(await screen.findByText('Job Description')).toBeInTheDocument();
    expect(screen.getAllByText('About the Data Analyst role')).toHaveLength(2);
  });

  // Known bug: the page loads data from /api/applications/my, which does not
  // include the job description, instead of /api/applications/history, which
  // does. So every row and the details panel say there is no description.
  it.failing('KNOWN BUG: shows the job description loaded from the server', async () => {
    fetchMyApplications.mockResolvedValue([
      // Shape of a real /my response: the job has no description field.
      {
        _id: 'a1',
        status: 'Applied',
        createdAt: '2026-11-09T12:00:00.000Z',
        job: { title: 'Data Analyst', company: 'Acme Corp', location: 'Montreal', category: 'Data' },
      },
    ]);
    render(<ApplicationHistory />);
    await screen.findByText('Data Analyst');

    expect(screen.queryByText('No description available')).not.toBeInTheDocument();
  });
});