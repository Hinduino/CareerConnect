import { useEffect, useState } from 'react';
import { fetchRecommendations } from '../api/recommendationApi';
import { toggleFavoriteJob, fetchFavoriteJobIds } from '../api/favoriteApi';
import { submitApplication, fetchMyApplications } from '../api/applicationApi';
import { fetchResumes } from '../api/resumeApi';
import { useAuth } from '../context/AuthContext';
import RecommendedJobCard from './RecommendedJobCard';

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

      {currentRequest?.result?.recommendations.map((recommendation) => {
        const jobId = String(recommendation.job.id);
        return (
          <RecommendedJobCard
            key={jobId}
            recommendation={recommendation}
            isFavorite={favoriteIds.has(jobId)}
            hasApplied={appliedIds.has(jobId)}
            isBusy={busyJobId === jobId}
            actionMessage={actionMessage}
            applicationError={applicationError}
            selectedResumeId={selectedResumeId}
            onViewDetails={onViewDetails}
            onFavorite={handleFavorite}
            onApply={handleApply}
          />
        );
      })}
    </main>
  );
}

export default Recommendations;
