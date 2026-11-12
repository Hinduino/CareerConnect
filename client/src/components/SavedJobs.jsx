import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchFavoriteJobs, toggleFavoriteJob } from '../api/favoriteApi';
import { formatPostedDate } from '../utils/dateUtils';

function SavedJobs({ onViewDetails }) {
  const { token } = useAuth();
  const [savedJobs, setSavedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadSavedJobs = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const data = await fetchFavoriteJobs(token);
        if (!cancelled) {
          setSavedJobs(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load saved jobs.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadSavedJobs();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleRemoveFavorite = async (jobId) => {
    setRemovingId(jobId);
    try {
      await toggleFavoriteJob(token, jobId);
      setSavedJobs((prev) => prev.filter((job) => job._id !== jobId));
    } catch (err) {
      alert(err.message || 'Failed to remove job from saved list.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="job-listing-container" style={{ maxWidth: '1000px', margin: '30px auto', padding: '0 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Saved Jobs</h2>
        <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
          Total Saved: <strong>{savedJobs.length}</strong>
        </span>
      </div>

      {loading && <p style={{ color: '#64748b' }}>Loading your saved jobs...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      {!loading && !error && savedJobs.length === 0 && (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px dashed #cbd5e1',
            color: '#64748b',
          }}
        >
          <h3>No saved jobs yet</h3>
          <p style={{ marginTop: '8px' }}>
            Browse available jobs and click the Save / Favorite button to bookmark roles for later.
          </p>
        </div>
      )}

      {!loading && savedJobs.length > 0 && (
        <div className="job-cards">
          {savedJobs.map((job) => (
            <div
              key={job._id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '16px',
                margin: '12px 0',
                backgroundColor: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '16px',
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 6px 0' }}>{job.title}</h3>
                <p style={{ margin: '0 0 4px 0' }}>
                  <strong>Company:</strong> {job.company}
                </p>
                <p style={{ margin: '0 0 6px 0', color: '#475569' }}>
                  <strong>Location:</strong> {job.location} | <strong>Category:</strong> {job.category}
                </p>
                {job.isArchived && (
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      fontSize: '0.75rem',
                      backgroundColor: '#fef3c7',
                      color: '#b45309',
                      borderRadius: '4px',
                      marginBottom: '6px',
                    }}
                  >
                    Archived by Recruiter
                  </span>
                )}
                <p className="job-card-dates" style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  {formatPostedDate(job.createdAt)}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => onViewDetails(job._id)}
                >
                  View Details
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={removingId === job._id}
                  onClick={() => handleRemoveFavorite(job._id)}
                  style={{
                    borderColor: '#fca5a5',
                    color: '#dc2626',
                  }}
                >
                  {removingId === job._id ? 'Removing...' : '★ Saved'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SavedJobs;