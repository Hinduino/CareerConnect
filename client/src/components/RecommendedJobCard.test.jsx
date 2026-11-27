const { fireEvent, render, screen } = require('@testing-library/react');
const RecommendedJobCard = require('./RecommendedJobCard').default;

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
  matchedQualifications: [],
  gaps: [],
};

function renderCard(overrides = {}) {
  const props = {
    recommendation,
    isFavorite: false,
    hasApplied: false,
    isBusy: false,
    actionMessage: null,
    applicationError: '',
    selectedResumeId: 'resume-1',
    onViewDetails: jest.fn(),
    onFavorite: jest.fn(),
    onApply: jest.fn(),
    ...overrides,
  };
  return { ...render(<RecommendedJobCard {...props} />), props };
}

describe('RecommendedJobCard', () => {
  it('hides optional details when absent and handles posting actions without a resume', () => {
    const { props } = renderCard({ selectedResumeId: '' });

    expect(screen.getByText('Your React experience matches this role.')).toBeInTheDocument();
    expect(screen.queryByText('Matching qualifications')).not.toBeInTheDocument();
    expect(screen.queryByText('Requirements to consider')).not.toBeInTheDocument();
    expect(screen.queryByText(/Apply by/)).not.toBeInTheDocument();
    expect(screen.getByText('Select a saved resume to apply directly.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply now' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'View full posting' }));
    fireEvent.click(screen.getByRole('button', { name: '☆ Save job' }));
    expect(props.onViewDetails).toHaveBeenCalledWith('job-1');
    expect(props.onFavorite).toHaveBeenCalledWith('job-1');
  });

  it('shows job qualifications and deadlines, and reports application errors', () => {
    renderCard({
      recommendation: {
        ...recommendation,
        job: { ...recommendation.job, dueDate: '2026-12-20T12:00:00.000Z' },
        matchedQualifications: ['React'],
        gaps: ['Testing experience'],
      },
      actionMessage: { jobId: 'job-1', type: 'error', text: 'Could not save this job.' },
      applicationError: 'Application history unavailable.',
    });

    expect(screen.getByText('Matching qualifications')).toBeInTheDocument();
    expect(screen.getByText('Requirements to consider')).toBeInTheDocument();
    expect(screen.getByText(/Apply by/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save this job.');
    expect(screen.getByText('Retry loading application history before applying.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Application status unavailable' })).toBeDisabled();
  });

  it('shows saved and already-applied states with a successful action message', () => {
    renderCard({
      isFavorite: true,
      hasApplied: true,
      isBusy: true,
      actionMessage: { jobId: 'job-1', type: 'success', text: 'Application submitted successfully.' },
    });

    expect(screen.getByRole('status')).toHaveTextContent('Application submitted successfully.');
    expect(screen.getByRole('button', { name: '★ Saved' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Already applied' })).toBeDisabled();
    expect(screen.queryByText('Select a saved resume to apply directly.')).not.toBeInTheDocument();
  });

  it('shows a submitting state and ignores messages for a different job', () => {
    renderCard({
      isBusy: true,
      actionMessage: { jobId: 'job-2', type: 'success', text: 'Another application was submitted.' },
    });

    expect(screen.getByRole('button', { name: 'Submitting...' })).toBeDisabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
