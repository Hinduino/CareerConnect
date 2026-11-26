const cardStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '20px',
  margin: '14px 0',
  backgroundColor: '#ffffff',
};

function RecommendedJobCard({
  recommendation,
  isFavorite,
  hasApplied,
  isBusy,
  actionMessage,
  applicationError,
  selectedResumeId,
  onViewDetails,
  onFavorite,
  onApply,
}) {
  const { job, reason, matchedQualifications, gaps } = recommendation;
  const jobId = String(job.id);

  return (
    <article style={cardStyle} aria-labelledby={`recommendation-${jobId}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h3 id={`recommendation-${jobId}`} style={{ marginTop: 0 }}>{job.title}</h3>
          <p><strong>{job.company}</strong> · {job.location}</p>
          <p><strong>Category:</strong> {job.category}</p>
        </div>
        {job.dueDate && (
          <p style={{ color: '#64748b' }}>
            Apply by {new Date(job.dueDate).toLocaleDateString()}
          </p>
        )}
      </div>

      <section aria-label={`Why ${job.title} is recommended`}>
        <h4>Why this job matches</h4>
        <p>{reason}</p>
      </section>

      {matchedQualifications.length > 0 && (
        <section>
          <h4>Matching qualifications</h4>
          <ul>{matchedQualifications.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
        </section>
      )}

      {gaps.length > 0 && (
        <section>
          <h4>Requirements to consider</h4>
          <ul>{gaps.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
        </section>
      )}

      {actionMessage?.jobId === jobId && (
        <p
          role={actionMessage.type === 'error' ? 'alert' : 'status'}
          style={{ color: actionMessage.type === 'error' ? '#b91c1c' : '#166534' }}
        >
          {actionMessage.text}
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button type="button" className="btn-primary" onClick={() => onViewDetails(jobId)}>
          View full posting
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={isBusy}
          onClick={() => onFavorite(jobId)}
        >
          {isFavorite ? '★ Saved' : '☆ Save job'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={isBusy || hasApplied || !selectedResumeId || Boolean(applicationError)}
          onClick={() => onApply(jobId)}
        >
          {hasApplied
            ? 'Already applied'
            : (applicationError ? 'Application status unavailable' : (isBusy ? 'Submitting...' : 'Apply now'))}
        </button>
      </div>
      {applicationError && (
        <p style={{ color: '#64748b' }}>
          Retry loading application history before applying.
        </p>
      )}
      {!selectedResumeId && !hasApplied && (
        <p style={{ color: '#64748b' }}>Select a saved resume to apply directly.</p>
      )}
    </article>
  );
}

export default RecommendedJobCard;
