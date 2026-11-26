const { fireEvent, render, screen, waitFor } = require('@testing-library/react');

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/applicationApi', () => ({
  fetchApplicationApplicant: jest.fn(),
  fetchApplicationResumeBlobUrl: jest.fn(),
}));
jest.mock('../utils/fileDownload', () => ({ downloadBlobUrl: jest.fn() }));

const ApplicantProfilePanel = require('./ApplicantProfilePanel').default;
const { useAuth } = require('../context/AuthContext');
const {
  fetchApplicationApplicant,
  fetchApplicationResumeBlobUrl,
} = require('../api/applicationApi');
const { downloadBlobUrl } = require('../utils/fileDownload');

const applicantProfile = {
  applicant: {
    id: 'user-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    role: 'job_seeker',
    location: 'Montreal',
    bio: 'Full-stack developer',
  },
  resume: {
    originalName: 'jane-resume.pdf',
    contentType: 'application/pdf',
    size: 2048,
  },
  application: {
    _id: 'app-1',
    status: 'Applied',
    createdAt: '2026-11-13T12:00:00Z',
    job: { _id: 'job-1', title: 'Backend Engineer', company: 'Acme Corp' },
  },
};

describe('ApplicantProfilePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ token: 'token' });
    fetchApplicationApplicant.mockResolvedValue(applicantProfile);
  });

  it('loads and displays the applicant personal and professional information', async () => {
    render(<ApplicantProfilePanel applicationId="app-1" onClose={() => {}} />);

    expect(screen.getByText('Loading applicant profile...')).toBeInTheDocument();

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(fetchApplicationApplicant).toHaveBeenCalledWith('token', 'app-1');
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('Job Seeker')).toBeInTheDocument();
    expect(screen.getByText('Montreal')).toBeInTheDocument();
    expect(screen.getByText('Full-stack developer')).toBeInTheDocument();
    expect(screen.getByText(/Backend Engineer at Acme Corp — Applied/)).toBeInTheDocument();
    expect(screen.getByText('jane-resume.pdf (2.0 KB)')).toBeInTheDocument();
  });

  it('falls back to placeholders when optional fields are missing', async () => {
    fetchApplicationApplicant.mockResolvedValue({
      applicant: { id: 'user-2', email: 'min@example.com', role: 'job_seeker' },
      resume: null,
      application: null,
    });

    render(<ApplicantProfilePanel applicationId="app-1" onClose={() => {}} />);

    expect(await screen.findByText('Unnamed Applicant')).toBeInTheDocument();
    expect(screen.getByText('No bio provided')).toBeInTheDocument();
    expect(screen.getByText('Not provided')).toBeInTheDocument();
    expect(screen.getByText('No resume attached to this application.')).toBeInTheDocument();
  });

  it('shows the error returned by the server', async () => {
    fetchApplicationApplicant.mockRejectedValue(
      new Error('You can only view applicants for your own job postings')
    );

    render(<ApplicantProfilePanel applicationId="app-1" onClose={() => {}} />);

    expect(
      await screen.findByText('You can only view applicants for your own job postings')
    ).toBeInTheDocument();
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = jest.fn();
    render(<ApplicantProfilePanel applicationId="app-1" onClose={onClose} />);

    await screen.findByText('Jane Doe');
    fireEvent.click(screen.getByText('Close'));

    expect(onClose).toHaveBeenCalled();
  });

  it('opens the resume inline in a new tab', async () => {
    fetchApplicationResumeBlobUrl.mockResolvedValue('blob:resume');
    window.open = jest.fn();

    render(<ApplicantProfilePanel applicationId="app-1" onClose={() => {}} />);

    await screen.findByText('Jane Doe');
    fireEvent.click(screen.getByText('View Resume'));

    await waitFor(() =>
      expect(fetchApplicationResumeBlobUrl).toHaveBeenCalledWith('token', 'app-1')
    );
    expect(window.open).toHaveBeenCalledWith('blob:resume', '_blank', 'noopener');
  });

  it('downloads the resume under its original filename', async () => {
    fetchApplicationResumeBlobUrl.mockResolvedValue('blob:resume');

    render(<ApplicantProfilePanel applicationId="app-1" onClose={() => {}} />);

    await screen.findByText('Jane Doe');
    fireEvent.click(screen.getByText('Download Resume'));

    await waitFor(() =>
      expect(fetchApplicationResumeBlobUrl).toHaveBeenCalledWith('token', 'app-1', { download: true })
    );
    expect(downloadBlobUrl).toHaveBeenCalledWith('blob:resume', 'jane-resume.pdf');
  });

  it('shows an error when the resume cannot be fetched', async () => {
    fetchApplicationResumeBlobUrl.mockRejectedValue(new Error('Failed to fetch resume file'));

    render(<ApplicantProfilePanel applicationId="app-1" onClose={() => {}} />);

    await screen.findByText('Jane Doe');
    fireEvent.click(screen.getByText('Download Resume'));

    expect(await screen.findByText('Failed to fetch resume file')).toBeInTheDocument();
  });
});

describe('ApplicantProfilePanel edge cases', () => {
  const { act } = require('@testing-library/react');

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ token: 'token' });
    fetchApplicationApplicant.mockResolvedValue(applicantProfile);
  });

  it('formats small resume sizes in bytes', async () => {
    fetchApplicationApplicant.mockResolvedValue({
      ...applicantProfile,
      resume: { originalName: 'tiny.pdf', size: 512 },
    });

    render(<ApplicantProfilePanel applicationId="app-1" onClose={() => {}} />);

    expect(await screen.findByText('tiny.pdf (512 B)')).toBeInTheDocument();
  });

  it('formats large resume sizes in megabytes', async () => {
    fetchApplicationApplicant.mockResolvedValue({
      ...applicantProfile,
      resume: { originalName: 'big.pdf', size: 3 * 1024 * 1024 },
    });

    render(<ApplicantProfilePanel applicationId="app-1" onClose={() => {}} />);

    expect(await screen.findByText('big.pdf (3.0 MB)')).toBeInTheDocument();
  });

  it('omits the size suffix when the resume size is unavailable', async () => {
    fetchApplicationApplicant.mockResolvedValue({
      ...applicantProfile,
      resume: { originalName: 'unsized.pdf' },
    });

    render(<ApplicantProfilePanel applicationId="app-1" onClose={() => {}} />);

    expect(await screen.findByText('unsized.pdf')).toBeInTheDocument();
  });

  it('shows the raw role when it has no friendly label', async () => {
    fetchApplicationApplicant.mockResolvedValue({
      ...applicantProfile,
      applicant: { ...applicantProfile.applicant, role: 'moderator' },
    });

    render(<ApplicantProfilePanel applicationId="app-1" onClose={() => {}} />);

    expect(await screen.findByText('moderator')).toBeInTheDocument();
  });

  it('omits the company when the applied-for job has none', async () => {
    fetchApplicationApplicant.mockResolvedValue({
      ...applicantProfile,
      application: {
        ...applicantProfile.application,
        job: { _id: 'job-1', title: 'Backend Engineer' },
      },
    });

    render(<ApplicantProfilePanel applicationId="app-1" onClose={() => {}} />);

    expect(await screen.findByText(/Backend Engineer — Applied/)).toBeInTheDocument();
    expect(screen.queryByText(/at Acme Corp/)).not.toBeInTheDocument();
  });

  it('downloads under a generic filename when the resume has no name', async () => {
    fetchApplicationApplicant.mockResolvedValue({
      ...applicantProfile,
      resume: { size: 2048 },
    });
    fetchApplicationResumeBlobUrl.mockResolvedValue('blob:resume');

    render(<ApplicantProfilePanel applicationId="app-1" onClose={() => {}} />);

    await screen.findByText('Jane Doe');
    fireEvent.click(screen.getByText('Download Resume'));

    await waitFor(() => expect(downloadBlobUrl).toHaveBeenCalledWith('blob:resume', 'resume'));
  });

  it('shows an error when the resume cannot be opened inline', async () => {
    fetchApplicationResumeBlobUrl.mockRejectedValue(new Error('Failed to fetch resume file'));
    window.open = jest.fn();

    render(<ApplicantProfilePanel applicationId="app-1" onClose={() => {}} />);

    await screen.findByText('Jane Doe');
    fireEvent.click(screen.getByText('View Resume'));

    expect(await screen.findByText('Failed to fetch resume file')).toBeInTheDocument();
    expect(window.open).not.toHaveBeenCalled();
  });

  it('ignores a profile that finishes loading after the panel closes', async () => {
    let resolveLoad;
    fetchApplicationApplicant.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve;
      })
    );

    const { unmount } = render(<ApplicantProfilePanel applicationId="app-1" onClose={() => {}} />);
    unmount();

    await act(async () => {
      resolveLoad(applicantProfile);
    });

    expect(fetchApplicationApplicant).toHaveBeenCalledWith('token', 'app-1');
  });

  it('ignores a load failure that happens after the panel closes', async () => {
    let rejectLoad;
    fetchApplicationApplicant.mockReturnValue(
      new Promise((resolve, reject) => {
        rejectLoad = reject;
      })
    );

    const { unmount } = render(<ApplicantProfilePanel applicationId="app-1" onClose={() => {}} />);
    unmount();

    await act(async () => {
      rejectLoad(new Error('late failure'));
    });

    expect(fetchApplicationApplicant).toHaveBeenCalledWith('token', 'app-1');
  });
});
