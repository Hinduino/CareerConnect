// SCRUM-305: Unit tests for the loading, error and empty states of the
// SCRUM-110 AI features (job recommendations page and resume feedback),
// which the story requires: "Provide loading indicators while AI requests are
// being processed" and "Display clear error messages when AI analysis is
// unavailable". Complements Recommendations.test.jsx and ResumeManager.test.jsx.
//
// Tests written with `it.failing` document known gaps. They pass while the
// gap exists and start failing once it is fixed.
const { fireEvent, render, screen, waitFor, within } = require('@testing-library/react');

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
jest.mock('../api/resumeApi', () => ({
  deleteResume: jest.fn(),
  fetchResumeBlobUrl: jest.fn(),
  fetchResumes: jest.fn(),
  replaceResume: jest.fn(),
  uploadResume: jest.fn(),
  fetchResumeFeedback: jest.fn(),
}));

const Recommendations = require('./Recommendations').default;
const ResumeManager = require('./ResumeManager').default;
const { useAuth } = require('../context/AuthContext');
const { fetchRecommendations } = require('../api/recommendationApi');
const { fetchFavoriteJobIds, toggleFavoriteJob } = require('../api/favoriteApi');
const { fetchMyApplications, submitApplication } = require('../api/applicationApi');
const { fetchResumes, fetchResumeFeedback } = require('../api/resumeApi');

const resume = { _id: 'resume-1', originalName: 'resume.pdf' };
const recommendation = {
  job: {
    id: 'job-1',
    title: 'Frontend Developer',
    company: 'Acme',
    location: 'Montreal',
    category: 'Engineering',
    dueDate: '2026-12-20T12:00:00.000Z',
  },
  reason: 'Your React experience matches this role.',
  matchedQualifications: ['React'],
  gaps: [],
};

// A promise the test resolves by hand, to look at the page while it waits
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderRecommendations(props = {}) {
  return render(<Recommendations onViewDetails={jest.fn()} onProfileClick={jest.fn()} {...props} />);
}

describe('Recommendations page states', () => {
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

  describe('loading', () => {
    it('shows a loading message while the profile and resumes load', async () => {
      const resumes = deferred();
      fetchResumes.mockReturnValue(resumes.promise);
      renderRecommendations();

      expect(screen.getByRole('status')).toHaveTextContent('Loading your profile and saved resumes...');

      resumes.resolve([resume]);
      expect(await screen.findByText('Frontend Developer')).toBeInTheDocument();
    });

    it('shows a loading message while the AI looks for matches', async () => {
      const recommendations = deferred();
      fetchRecommendations.mockReturnValue(recommendations.promise);
      renderRecommendations();

      expect(await screen.findByText('Finding available jobs that match your information...')).toBeInTheDocument();

      recommendations.resolve({ recommendations: [recommendation] });
      expect(await screen.findByText('Frontend Developer')).toBeInTheDocument();
      expect(screen.queryByText('Finding available jobs that match your information...')).not.toBeInTheDocument();
    });
  });

  describe('errors', () => {
    it('shows the AI service error and retries on "Try again"', async () => {
      fetchRecommendations
        .mockRejectedValueOnce(new Error('The recommendation service is busy. Please try again later.'))
        .mockResolvedValueOnce({ recommendations: [recommendation] });
      renderRecommendations();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('The recommendation service is busy. Please try again later.');

      fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));

      expect(await screen.findByText('Frontend Developer')).toBeInTheDocument();
      expect(fetchRecommendations).toHaveBeenCalledTimes(2);
    });

    it('falls back to a general message when the error has no text', async () => {
      fetchRecommendations.mockRejectedValue(new Error(''));
      renderRecommendations();

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not load job recommendations.');
    });

    it('explains when saved resumes cannot be loaded and lets the applicant retry', async () => {
      fetchResumes
        .mockRejectedValueOnce(new Error('Could not load your saved resumes.'))
        .mockResolvedValueOnce([resume]);
      renderRecommendations();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Could not load your saved resumes.');
      expect(fetchRecommendations).not.toHaveBeenCalled();

      fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));

      expect(await screen.findByText('Frontend Developer')).toBeInTheDocument();
    });

    it('shows an error when saving a recommended job fails', async () => {
      toggleFavoriteJob.mockRejectedValue(new Error('Could not update saved jobs.'));
      renderRecommendations();
      await screen.findByText('Frontend Developer');

      fireEvent.click(screen.getByRole('button', { name: '☆ Save job' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not update saved jobs.');
    });

    it('shows an error when applying to a recommended job fails', async () => {
      submitApplication.mockRejectedValue(
        new Error('This job posting has expired and no longer accepts applications.')
      );
      renderRecommendations();
      await screen.findByText('Frontend Developer');

      fireEvent.click(screen.getByRole('button', { name: 'Apply now' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'This job posting has expired and no longer accepts applications.'
      );
    });
  });

  describe('empty results', () => {
    it('shows the message from the server when there is nothing to recommend', async () => {
      fetchRecommendations.mockResolvedValue({
        recommendations: [],
        message: 'Add a profile summary or resume to get personalized job recommendations.',
      });
      renderRecommendations();

      expect(await screen.findByText('No recommendations yet')).toBeInTheDocument();
      expect(
        screen.getByText('Add a profile summary or resume to get personalized job recommendations.')
      ).toBeInTheDocument();
    });

    it('shows a default message when the AI finds no strong matches', async () => {
      fetchRecommendations.mockResolvedValue({ recommendations: [] });
      renderRecommendations();

      expect(
        await screen.findByText('There are no strong matches among currently available jobs.')
      ).toBeInTheDocument();
    });

    it('offers a link to the profile when the applicant has no saved resumes', async () => {
      const onProfileClick = jest.fn();
      fetchResumes.mockResolvedValue([]);
      renderRecommendations({ onProfileClick });
      await screen.findByText('Frontend Developer');

      expect(fetchRecommendations).toHaveBeenCalledWith('token', null);
      fireEvent.click(screen.getByRole('button', { name: 'Add a resume in your profile' }));
      expect(onProfileClick).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Apply now' })).toBeDisabled();
      expect(screen.getByText('Select a saved resume to apply directly.')).toBeInTheDocument();
    });
  });

  describe('recommendation cards', () => {
    it('shows the application deadline when the posting has one', async () => {
      renderRecommendations();
      await screen.findByText('Frontend Developer');

      expect(
        screen.getByText(`Apply by ${new Date(recommendation.job.dueDate).toLocaleDateString()}`)
      ).toBeInTheDocument();
    });

    it('marks jobs the applicant already applied to and disables Apply', async () => {
      fetchMyApplications.mockResolvedValue([{ _id: 'app-1', job: { _id: 'job-1' }, status: 'Applied' }]);
      renderRecommendations();
      await screen.findByText('Frontend Developer');

      await waitFor(() => expect(screen.getByRole('button', { name: 'Already applied' })).toBeDisabled());
    });

    it('shows jobs already saved as "★ Saved"', async () => {
      fetchFavoriteJobIds.mockResolvedValue(['job-1']);
      renderRecommendations();
      await screen.findByText('Frontend Developer');

      expect(await screen.findByRole('button', { name: '★ Saved' })).toBeInTheDocument();
    });
  });

  // Known gap: SCRUM-110 requires AI recommendations to be "clearly
  // identified as suggestions rather than guaranteed results", but the page
  // shows no notice that the matches are AI-generated.
  it.failing('KNOWN GAP: tells the applicant the matches are AI-generated suggestions', async () => {
    renderRecommendations();
    await screen.findByText('Frontend Developer');

    expect(screen.getByText(/AI-generated|not guaranteed|suggestions only/i)).toBeInTheDocument();
  });
});

describe('Resume feedback states', () => {
  const savedResume = { id: 'resume-1', originalName: 'resume.pdf', contentType: 'application/pdf', size: 2048 };

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ token: 'token', isAuthenticated: true, user: { role: 'job_seeker' } });
    fetchResumes.mockResolvedValue([savedResume]);
    URL.createObjectURL = jest.fn();
    URL.revokeObjectURL = jest.fn();
  });

  it('shows how to get feedback before any is requested', async () => {
    render(<ResumeManager />);
    await screen.findAllByText('resume.pdf');

    expect(
      screen.getByText(/Choose Resume Feedback beside a saved resume to get a summary, strengths, and improvement suggestions\./)
    ).toBeInTheDocument();
  });

  it('shows a loading state and blocks other actions while the AI analyzes', async () => {
    const feedback = deferred();
    fetchResumeFeedback.mockReturnValue(feedback.promise);
    render(<ResumeManager />);
    await screen.findAllByText('resume.pdf');

    fireEvent.click(screen.getByRole('button', { name: 'Resume Feedback' }));

    expect(await screen.findByText('Analyzing your resume...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyzing...' })).toBeDisabled();

    feedback.resolve({ summary: 'Clear resume.', strengths: ['React'], recommendations: ['Add metrics'] });

    expect(await screen.findByText('Clear resume.')).toBeInTheDocument();
    expect(screen.queryByText('Analyzing your resume...')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume Feedback' })).toBeEnabled();
  });

  it('says which resume the feedback is for', async () => {
    fetchResumeFeedback.mockResolvedValue({ summary: 'Clear resume.', strengths: [], recommendations: [] });
    render(<ResumeManager />);
    await screen.findAllByText('resume.pdf');

    fireEvent.click(screen.getByRole('button', { name: 'Resume Feedback' }));

    expect(await screen.findByText('Feedback for resume.pdf')).toBeInTheDocument();
  });

  it('handles feedback with no suggestions', async () => {
    fetchResumeFeedback.mockResolvedValue({ summary: 'Clear resume.', strengths: ['React'], recommendations: [] });
    render(<ResumeManager />);
    await screen.findAllByText('resume.pdf');

    fireEvent.click(screen.getByRole('button', { name: 'Resume Feedback' }));

    expect(await screen.findByText('No improvement suggestions were returned.')).toBeInTheDocument();
  });

  it('lets the applicant try again after an error', async () => {
    fetchResumeFeedback
      .mockRejectedValueOnce(new Error('Resume feedback is temporarily busy. Please try again later.'))
      .mockResolvedValueOnce({ summary: 'Clear resume.', strengths: [], recommendations: [] });
    render(<ResumeManager />);
    await screen.findAllByText('resume.pdf');

    fireEvent.click(screen.getByRole('button', { name: 'Resume Feedback' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Resume feedback is temporarily busy.');

    fireEvent.click(screen.getByRole('button', { name: 'Resume Feedback' }));

    expect(await screen.findByText('Clear resume.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not offer resume feedback to recruiters', () => {
    useAuth.mockReturnValue({ token: 'token', isAuthenticated: true, user: { role: 'recruiter' } });
    const { container } = render(<ResumeManager />);

    expect(container).toBeEmptyDOMElement();
    expect(fetchResumes).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Resume Feedback' })).not.toBeInTheDocument();
    expect(screen.queryByText('AI Resume Feedback')).not.toBeInTheDocument();
  });
});