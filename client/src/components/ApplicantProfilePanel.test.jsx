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
