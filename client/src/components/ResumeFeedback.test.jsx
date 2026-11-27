const { render, screen } = require('@testing-library/react');
const ResumeFeedback = require('./ResumeFeedback').default;

describe('ResumeFeedback', () => {
  it('shows instructions before feedback is requested', () => {
    render(<ResumeFeedback feedback={null} loading={false} error="" />);

    expect(screen.getByText(/Choose Resume Feedback beside a saved resume/)).toBeInTheDocument();
  });

  it('shows progress and errors while feedback is unavailable', () => {
    const { rerender } = render(<ResumeFeedback feedback={null} loading error="" />);

    expect(screen.getByRole('status')).toHaveTextContent('Analyzing your resume...');
    rerender(<ResumeFeedback feedback={null} loading={false} error="Feedback service unavailable." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Feedback service unavailable.');
    expect(screen.queryByText(/Choose Resume Feedback beside a saved resume/)).not.toBeInTheDocument();
  });

  it('shows empty states when the AI returns no strengths or recommendations', () => {
    render(
      <ResumeFeedback
        feedback={{
          resumeName: 'resume.pdf',
          summary: 'A clear resume.',
          strengths: [],
          recommendations: [],
        }}
        loading={false}
        error=""
      />
    );

    expect(screen.getByText('A clear resume.')).toBeInTheDocument();
    expect(screen.getByText('No strengths were identified.')).toBeInTheDocument();
    expect(screen.getByText('No improvement suggestions were returned.')).toBeInTheDocument();
  });
});
