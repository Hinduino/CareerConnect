import { useEffect, useState } from 'react';
import { fetchRecommendations } from '../api/recommendationApi';
import { toggleFavoriteJob, fetchFavoriteJobIds } from '../api/favoriteApi';
import { submitApplication, fetchMyApplications } from '../api/applicationApi';
import { fetchResumes } from '../api/resumeApi';
import { useAuth } from '../context/AuthContext';

function getResumeId(resume) {
  return resume._id || resume.id;
}

function getJobId(application) {
  return application.job?._id || application.job;
}

function Recommendations({ onViewDetails, onProfileClick }) {
  const { token } = useAuth();
  const [sourceData, setSourceData] = useState(null);
  const [sourceError, setSourceError] = useState('');
  const [favoriteError, setFavoriteError] = useState('');
  const [applicationError, setApplicationError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [resumeChoice, setResumeChoice] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [appliedIds, setAppliedIds] = useState(new Set());
  const [recommendationRequest, setRecommendationRequest] = useState(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [busyJobId, setBusyJobId] = useState('');
  const [actionMessage, setActionMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchResumes(token)
      .then((resumes) => {
        if (!cancelled) setSourceData(resumes);
      })
      .catch((error) => {
        if (!cancelled) setSourceError(error.message || 'Could not load your saved resumes.');
      });
    fetchFavoriteJobIds(token)
      .then((favorites) => {
        if (!cancelled) setFavoriteIds(new Set(favorites.map(String)));
      })
      .catch((error) => {
        if (!cancelled) setFavoriteError(error.message || 'Could not load your saved jobs.');
      });
    fetchMyApplications(token)
      .then((applications) => {
        if (!cancelled) setAppliedIds(new Set(applications.map(getJobId).filter(Boolean).map(String)));
      })
      .catch((error) => {
        if (!cancelled) setApplicationError(error.message || 'Could not check your application history.');
      });

    return () => {
      cancelled = true;
    };
  }, [token, loadAttempt]);

  const retryProfileData = () => {
    setSourceError('');
    setFavoriteError('');
    setApplicationError('');
    setLoadAttempt((attempt) => attempt + 1);
  };

  const selectedResumeId = resumeChoice?.token === token
    ? resumeChoice.id
    : (sourceData?.[0] ? getResumeId(sourceData[0]) : '');
  const currentRequest = recommendationRequest
    && recommendationRequest.token === token
    && recommendationRequest.resumeId === selectedResumeId
    && recommendationRequest.version === refreshVersion
    ? recommendationRequest
    : null;

  useEffect(() => {
    if (!sourceData || sourceError) return undefined;
    let cancelled = false;

    fetchRecommendations(token, selectedResumeId || null)
      .then((result) => {
        if (!cancelled) {
          setRecommendationRequest({
            token,
            resumeId: selectedResumeId,
            version: refreshVersion,
            result,
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRecommendationRequest({
            token,
            resumeId: selectedResumeId,
            version: refreshVersion,
            error: error.message || 'Could not load job recommendations.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, sourceData, sourceError, selectedResumeId, refreshVersion]);

  const handleResumeChange = (event) => {
    setResumeChoice({ token, id: event.target.value });
  };

  const handleFavorite = async (jobId) => {
    setBusyJobId(jobId);
    setActionMessage(null);
    try {
      const result = await toggleFavoriteJob(token, jobId);
      setFavoriteIds(new Set((result.savedJobIds || []).map(String)));
    } catch (error) {
      setActionMessage({ type: 'error', text: error.message || 'Could not update saved jobs.' });
    } finally {
      setBusyJobId('');
    }
  };

  const handleApply = async (jobId) => {
    if (!selectedResumeId) {
      setActionMessage({ type: 'error', text: 'Select a resume before applying.' });
      return;
    }
    setBusyJobId(jobId);
    setActionMessage(null);
    try {
      await submitApplication(token, jobId, selectedResumeId);
      setAppliedIds((previous) => new Set([...previous, jobId]));
      setActionMessage({ type: 'success', jobId, text: 'Application submitted successfully.' });
    } catch (error) {
      setActionMessage({ type: 'error', jobId, text: error.message || 'Could not submit your application.' });
    } finally {
      setBusyJobId('');
    }
  };

  const pageStyle = { maxWidth: '1000px', margin: '30px auto', padding: '0 20px' };
  const cardStyle = {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '20px',
    margin: '14px 0',
    backgroundColor: '#ffffff',
  };

  return (
    <main className="job-listing-container" style={pageStyle}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <h2>
            Personalized Recommendations
            <span className="recommendations-ai-indicator" role="img" aria-label="AI-generated">
              ✨
            </span>
          </h2>
          <p style={{ color: '#64748b' }}>
            AI-generated recommendations matched to your profile and selected resume.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          disabled={!sourceData || Boolean(sourceError) || !currentRequest}
          onClick={() => setRefreshVersion((version) => version + 1)}
        >
          Refresh
        </button>
      </header>

      {sourceError && (
        <div role="alert" style={cardStyle}>
          <p>{sourceError}</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={retryProfileData}
          >
            Try again
          </button>
        </div>
      )}

      {!sourceError && (favoriteError || applicationError) && (
        <div role="alert" style={cardStyle}>
          <p>{[favoriteError, applicationError].filter(Boolean).join(' ')}</p>
          <button type="button" className="btn-secondary" onClick={retryProfileData}>
            Retry profile data
          </button>
        </div>
      )}

      {!sourceError && !sourceData && <p role="status">Loading your profile and saved resumes...</p>}

      {!sourceError && sourceData && (
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label htmlFor="recommendation-resume"><strong>Resume for matching and applications</strong></label>
          <select
            id="recommendation-resume"
            value={selectedResumeId}
            onChange={handleResumeChange}
          >
            <option value="">Use profile information only</option>
            {sourceData.map((resume) => (
              <option key={getResumeId(resume)} value={getResumeId(resume)}>
                {resume.originalName}
              </option>
            ))}
          </select>
          {sourceData.length === 0 && (
            <span style={{ color: '#64748b' }}>
              No saved resumes.{' '}
              <button type="button" className="btn-secondary" onClick={onProfileClick}>
                Add a resume in your profile
              </button>
            </span>
          )}
        </div>
      )}

      {actionMessage && !actionMessage.jobId && (
        <p
          role={actionMessage.type === 'error' ? 'alert' : 'status'}
          style={{ color: actionMessage.type === 'error' ? '#b91c1c' : '#166534' }}
        >
          {actionMessage.text}
        </p>
      )}

      {!sourceError && sourceData && !currentRequest && (
        <p role="status">Finding available jobs that match your information...</p>
      )}
      {currentRequest?.error && (
        <div role="alert" style={cardStyle}>
          <p>{currentRequest.error}</p>
          <button type="button" className="btn-secondary" onClick={() => setRefreshVersion((version) => version + 1)}>
            Try again
          </button>
        </div>
      )}

      {currentRequest?.result && currentRequest.result.recommendations.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', color: '#64748b' }}>
          <h3>No recommendations yet</h3>
          <p>{currentRequest.result.message || 'There are no strong matches among currently available jobs.'}</p>
        </div>
      )}

      {currentRequest?.result?.recommendations.map(({ job, reason, matchedQualifications, gaps }) => {
        const jobId = String(job.id);
        const isFavorite = favoriteIds.has(jobId);
        const hasApplied = appliedIds.has(jobId);
        const isBusy = busyJobId === jobId;

        return (
          <article key={jobId} style={cardStyle} aria-labelledby={`recommendation-${jobId}`}>
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
                onClick={() => handleFavorite(jobId)}
              >
                {isFavorite ? '★ Saved' : '☆ Save job'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={isBusy || hasApplied || !selectedResumeId || Boolean(applicationError)}
                onClick={() => handleApply(jobId)}
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
      })}
    </main>
  );
}

export default Recommendations;
