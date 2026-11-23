const { fireEvent, render, screen, waitFor } = require('@testing-library/react');

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/recommendationApi', () => ({ fetchRecommendations: jest.fn() }));
jest.mock('../api/favoriteApi', () => ({
  fetchFavoriteJobIds: jest.fn(),
  toggleFavoriteJob: jest.fn(),
}));
jest.mock('../api/applicationApi', () => ({
  fetchMyApplications: jest.fn(),
  submitApplication: jest.fn(),
}));
jest.mock('../api/resumeApi', () => ({ fetchResumes: jest.fn() }));

const Recommendations = require('./Recommendations').default;
const { useAuth } = require('../context/AuthContext');
const { fetchRecommendations } = require('../api/recommendationApi');
const { fetchFavoriteJobIds, toggleFavoriteJob } = require('../api/favoriteApi');
const { fetchMyApplications, submitApplication } = require('../api/applicationApi');
const { fetchResumes } = require('../api/resumeApi');

const resume = { _id: 'resume-1', originalName: 'resume.pdf' };
const recommendation = {
  job: {
    id: 'job-1',
    title: 'Frontend Developer',
    company: 'Acme',
    location: 'Montreal',
    category: 'Engineering',
    dueDate: null,
  },
  reason: 'Your React experience matches this role.',
  matchedQualifications: ['React'],
  gaps: ['Three years of experience is preferred.'],
};

describe('Recommendations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ token: 'token' });
    fetchResumes.mockResolvedValue([resume]);
    fetchFavoriteJobIds.mockResolvedValue([]);
    fetchMyApplications.mockResolvedValue([]);
    fetchRecommendations.mockResolvedValue({ recommendations: [recommendation] });
    toggleFavoriteJob.mockResolvedValue({ savedJobIds: ['job-1'] });
    submitApplication.mockResolvedValue({});
  });

  it('shows reasons, qualification evidence, category and opens full job details', async () => {
    const onViewDetails = jest.fn();
    render(<Recommendations onViewDetails={onViewDetails} onProfileClick={jest.fn()} />);

    expect(screen.getByRole('img', { name: 'AI-generated' })).toBeInTheDocument();
    expect(await screen.findByText('Your React experience matches this role.')).toBeInTheDocument();
    expect(screen.getByText('Matching qualifications')).toBeInTheDocument();
    expect(screen.getByText('Three years of experience is preferred.')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(fetchRecommendations).toHaveBeenCalledWith('token', 'resume-1');

    fireEvent.click(screen.getByRole('button', { name: 'View full posting' }));
    expect(onViewDetails).toHaveBeenCalledWith('job-1');
  });

  it('lets the applicant save and directly apply to a recommendation using the selected resume', async () => {
    render(<Recommendations onViewDetails={jest.fn()} onProfileClick={jest.fn()} />);
    await screen.findByText('Your React experience matches this role.');

    fireEvent.click(screen.getByRole('button', { name: '☆ Save job' }));
    await waitFor(() => expect(toggleFavoriteJob).toHaveBeenCalledWith('token', 'job-1'));
    expect(await screen.findByRole('button', { name: '★ Saved' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply now' }));
    await waitFor(() => expect(submitApplication).toHaveBeenCalledWith('token', 'job-1', 'resume-1'));
    expect(await screen.findByText('Application submitted successfully.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Already applied' })).toBeDisabled();
  });

  it('regenerates recommendations when a different resume is selected and on refresh', async () => {
    fetchResumes.mockResolvedValue([
      resume,
      { _id: 'resume-2', originalName: 'updated-resume.pdf' },
    ]);
    render(<Recommendations onViewDetails={jest.fn()} onProfileClick={jest.fn()} />);
    await screen.findByText('Your React experience matches this role.');

    fireEvent.change(screen.getByLabelText('Resume for matching and applications'), {
      target: { value: 'resume-2' },
    });
    await waitFor(() => expect(fetchRecommendations).toHaveBeenCalledWith('token', 'resume-2'));

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(fetchRecommendations).toHaveBeenCalledTimes(3));
  });

  it('still shows recommendations if application history cannot be loaded', async () => {
    fetchMyApplications.mockRejectedValue(new Error('Application history unavailable.'));
    render(<Recommendations onViewDetails={jest.fn()} onProfileClick={jest.fn()} />);

    expect(await screen.findByText('Your React experience matches this role.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Application status unavailable' })).toBeDisabled();
    expect(screen.getByText('Application history unavailable.')).toBeInTheDocument();
  });
});
