function ResumeFeedback({ feedback, loading, error }) {
  return (
    <section className="resume-feedback" aria-labelledby="resume-feedback-title" aria-live="polite">
      <h3 id="resume-feedback-title">AI Resume Feedback</h3>
      {loading && <p role="status">Analyzing your resume...</p>}
      {error && <p className="resume-error" role="alert">{error}</p>}
      {!feedback && !loading && !error && (
        <p className="resume-hint">
          Choose Resume Feedback beside a saved resume to get a summary, strengths, and improvement suggestions.
        </p>
      )}
      {feedback && (
        <div>
          <p className="resume-meta">Feedback for {feedback.resumeName}</p>
          <p>{feedback.summary}</p>
          <div className="resume-feedback-columns">
            <div>
              <h4>Strengths</h4>
              {feedback.strengths.length > 0 ? (
                <ul>{feedback.strengths.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
              ) : <p>No strengths were identified.</p>}
            </div>
            <div>
              <h4>Recommendations</h4>
              {feedback.recommendations.length > 0 ? (
                <ul>{feedback.recommendations.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
              ) : <p>No improvement suggestions were returned.</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ResumeFeedback;
