const { fireEvent, render, screen, waitFor } = require('@testing-library/react');

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/jobApi', () => ({ fetchJob: jest.fn() }));
jest.mock('../api/resumeApi', () => ({ fetchResumes: jest.fn() }));
jest.mock('../api/applicationApi', () => ({
  fetchApplicationStatus: jest.fn(),
  submitApplication: jest.fn(),
  cancelApplication: jest.fn(),
}));

const JobDetail = require('./JobDetail').default;
const { useAuth } = require('../context/AuthContext');
const { fetchJob } = require('../api/jobApi');
const { fetchResumes } = require('../api/resumeApi');
const { fetchApplicationStatus, submitApplication, cancelApplication } = require('../api/applicationApi');

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

describe('JobDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchJob.mockResolvedValue(sampleJob);
    useAuth.mockReturnValue({
      token: 'token',
      isAuthenticated: true,
      user: { id: 'user-1', role: 'job_seeker' }
    });
    fetchApplicationStatus.mockResolvedValue({ applied: false, applicationId: null });
    fetchResumes.mockResolvedValue([{ id: 'resume-1', originalName: 'resume.pdf' }]);
    window.confirm = jest.fn(() => true);
  });

it('allows visitors to view jobs but requires login before applying', async () => {
    useAuth.mockReturnValue({ token: null, isAuthenticated: false, user: null });
    render(<JobDetail jobId="job-1" onBack={() => {}} />);

    // Visitors can view job details.
    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument();

    // Visitors can see the Apply Now button.
    const applyButton = screen.getByRole('button', { name: 'Apply Now' });
    expect(applyButton).toBeInTheDocument();

    // Clicking Apply Now requires authentication.
    fireEvent.click(applyButton);

    expect(
      screen.getByText('Please log in or sign up to apply for this job.')
    ).toBeInTheDocument();

    // No application is submitted without authentication.
    expect(submitApplication).not.toHaveBeenCalled();
  });


  it('prompts the applicant to upload a resume when none are saved', async () => {
    fetchResumes.mockResolvedValue([]);
    render(<JobDetail jobId="job-1" onBack={() => {}} />);

    expect(
      await screen.findByText('Upload a resume in your profile before applying for this job.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Apply Now')).not.toBeInTheDocument();
  });

  it('lets the applicant pick a resume, submit an application, and hides the Apply button afterward', async () => {
    submitApplication.mockResolvedValue({ application: { _id: 'app-1' } });
    render(<JobDetail jobId="job-1" onBack={() => {}} />);

    const select = await screen.findByLabelText('Select a resume to apply with');
    expect(select.value).toBe('resume-1');

    fireEvent.click(screen.getByText('Apply Now'));

    await waitFor(() => expect(submitApplication).toHaveBeenCalledWith('token', 'job-1', 'resume-1'));
    expect(await screen.findByText('Cancel Application')).toBeInTheDocument();
    expect(screen.queryByText('Apply Now')).not.toBeInTheDocument();
  });

  it('shows a Cancel Application button when already applied, and Apply Now reappears after cancelling', async () => {
    fetchApplicationStatus.mockResolvedValue({ applied: true, applicationId: 'app-1' });
    cancelApplication.mockResolvedValue({ message: 'Application cancelled successfully.' });
    render(<JobDetail jobId="job-1" onBack={() => {}} />);

    expect(await screen.findByText('Cancel Application')).toBeInTheDocument();
    expect(screen.queryByText('Apply Now')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel Application'));

    await waitFor(() => expect(cancelApplication).toHaveBeenCalledWith('token', 'app-1'));
    expect(await screen.findByText('Apply Now')).toBeInTheDocument();
  });
  it('prevents recruiters from applying for jobs', async () => {
  useAuth.mockReturnValue({
    token: 'token',
    isAuthenticated: true,
    user: { id: 'recruiter-1', role: 'recruiter' }
  });

  render(<JobDetail jobId="job-1" onBack={() => {}} />);

  expect(
    await screen.findByText('Backend Engineer')
  ).toBeInTheDocument();

  expect(screen.queryByText('Apply Now')).not.toBeInTheDocument();
  expect(screen.queryByText('Cancel Application')).not.toBeInTheDocument();

  expect(fetchApplicationStatus).not.toHaveBeenCalled();
  expect(fetchResumes).not.toHaveBeenCalled();
  expect(submitApplication).not.toHaveBeenCalled();
  expect(cancelApplication).not.toHaveBeenCalled();
});
it('prevents applications when application status cannot be verified', async () => {
  fetchApplicationStatus.mockRejectedValue(
    new Error('Network error')
  );

  render(<JobDetail jobId="job-1" onBack={() => {}} />);

  expect(
    await screen.findByText(
      'Unable to verify your application status. Please try again later.'
    )
  ).toBeInTheDocument();

  expect(screen.queryByText('Apply Now')).not.toBeInTheDocument();
  expect(screen.queryByText('Cancel Application')).not.toBeInTheDocument();

  expect(submitApplication).not.toHaveBeenCalled();
  expect(cancelApplication).not.toHaveBeenCalled();
});
it('prevents applications when resume retrieval fails', async () => {
    fetchResumes.mockRejectedValue(new Error('Network error'));

    render(<JobDetail jobId="job-1" onBack={() => {}} />);

    expect(
        await screen.findByText(
            'Unable to load your resumes. Please try again later.'
        )
    ).toBeInTheDocument();

    expect(screen.queryByText('Apply Now')).not.toBeInTheDocument();

    expect(
        screen.queryByText(
            'Upload a resume in your profile before applying for this job.'
        )
    ).not.toBeInTheDocument();

    expect(submitApplication).not.toHaveBeenCalled();
});
it('updates the selected resume when the saved resume list changes', async () => {
    const { rerender } = render(
        <JobDetail jobId="job-1" onBack={() => {}} />
    );

    const select = await screen.findByLabelText(
        'Select a resume to apply with'
    );

    expect(select.value).toBe('resume-1');

    fetchResumes.mockResolvedValue([
        { id: 'resume-2', originalName: 'updated-resume.pdf' }
    ]);

    useAuth.mockReturnValue({
        token: 'updated-token',
        isAuthenticated: true,
        user: { id: 'user-1', role: 'job_seeker' }
    });

    rerender(<JobDetail jobId="job-1" onBack={() => {}} />);

    await waitFor(() => {
        expect(
            screen.getByLabelText('Select a resume to apply with').value
        ).toBe('resume-2');
    });

    submitApplication.mockResolvedValue({
        application: { _id: 'app-1' }
    });

    fireEvent.click(screen.getByText('Apply Now'));

    await waitFor(() => {
        expect(submitApplication).toHaveBeenCalledWith(
            'updated-token',
            'job-1',
            'resume-2'
        );
    });

    expect(
        await screen.findByText('Cancel Application')
    ).toBeInTheDocument();
});
it('keeps the Apply button available when submission fails', async () => {
    submitApplication.mockRejectedValue(
        new Error('Failed to submit application.')
    );

    render(<JobDetail jobId="job-1" onBack={() => {}} />);

    const applyButton = await screen.findByRole('button', {
        name: 'Apply Now'
    });

    fireEvent.click(applyButton);

    expect(
        await screen.findByText('Failed to submit application.')
    ).toBeInTheDocument();

    expect(submitApplication).toHaveBeenCalledWith(
        'token', 'job-1', 'resume-1'
    );

    expect(applyButton).toBeEnabled();

    expect(
        screen.queryByText('Cancel Application')
    ).not.toBeInTheDocument();
});
it('preserves the application when cancellation fails', async () => {
    fetchApplicationStatus.mockResolvedValue({
        applied: true,
        applicationId: 'app-1'
    });

    cancelApplication.mockRejectedValue(
        new Error('Failed to cancel application.')
    );

    render(<JobDetail jobId="job-1" onBack={() => {}} />);

    const cancelButton = await screen.findByRole('button', {
        name: 'Cancel Application'
    });

    fireEvent.click(cancelButton);

    expect(
        await screen.findByText('Failed to cancel application.')
    ).toBeInTheDocument();

    expect(cancelApplication).toHaveBeenCalledWith(
        'token', 'app-1'
    );

    expect(cancelButton).toBeEnabled();

    expect(
        screen.queryByText('Apply Now')
    ).not.toBeInTheDocument();
});
it('does not cancel an application when confirmation is dismissed', async () => {
    fetchApplicationStatus.mockResolvedValue({
        applied: true,
        applicationId: 'app-1'
    });

    window.confirm.mockReturnValue(false);

    render(<JobDetail jobId="job-1" onBack={() => {}} />);

    const cancelButton = await screen.findByRole('button', {
        name: 'Cancel Application'
    });

    fireEvent.click(cancelButton);

    expect(window.confirm).toHaveBeenCalledWith(
        'Cancel this application?'
    );

    expect(cancelApplication).not.toHaveBeenCalled();

    expect(cancelButton).toBeEnabled();

    expect(
        screen.queryByText('Apply Now')
    ).not.toBeInTheDocument();
});
});
