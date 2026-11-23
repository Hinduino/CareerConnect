import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchApplicationApplicant, fetchApplicationResumeBlobUrl } from '../api/applicationApi';
import { downloadBlobUrl } from '../utils/fileDownload';

const ROLE_LABELS = {
  job_seeker: 'Job Seeker',
  recruiter: 'Recruiter',
};

function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Recruiter-only dialog showing a job seeker's professional profile for one
// of the recruiter's own applications: personal details, bio, and the resume
// that was attached when the candidate applied.
function ApplicantProfilePanel({ applicationId, onClose }) {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Resume view/download failures are shown without hiding the profile.
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadApplicant = async () => {
      setLoading(true);
      setError('');
      setData(null);
      try {
        const result = await fetchApplicationApplicant(token, applicationId);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Errors are handled inside loadApplicant, so the promise is safe to drop.
    void loadApplicant();

    return () => {
      cancelled = true;
    };
  }, [token, applicationId]);

  // The resume request needs an Authorization header, so both actions go
  // through a short-lived blob URL instead of a plain link.
  const handleViewResume = async () => {
    try {
      const blobUrl = await fetchApplicationResumeBlobUrl(token, applicationId);
      window.open(blobUrl, '_blank', 'noopener');
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleDownloadResume = async () => {
    try {
      const blobUrl = await fetchApplicationResumeBlobUrl(token, applicationId, { download: true });
      downloadBlobUrl(blobUrl, data?.resume?.originalName || 'resume');
    } catch (err) {
      setActionError(err.message);
    }
  };

  const applicant = data?.applicant;
  const resume = data?.resume;
  const application = data?.application;

  const details = applicant
    ? [
        { label: 'Email', value: applicant.email },
        { label: 'Role', value: ROLE_LABELS[applicant.role] || applicant.role },
        { label: 'Location', value: applicant.location },
      ]
    : [];

  return (
    <div className="applicant-profile-overlay" role="dialog" aria-modal="true" aria-label="Applicant profile">
      <div className="profile-container applicant-profile-panel">
        <div className="profile-header">
          <h2>Applicant Profile</h2>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {loading && <p>Loading applicant profile...</p>}
        {(error || actionError) && (
          <p role="alert" className="resume-error">{error || actionError}</p>
        )}

        {!loading && !error && applicant && (
          <>
            <div className="profile-identity">
              <h3 className="profile-name">{applicant.name || 'Unnamed Applicant'}</h3>
              {applicant.bio ? (
                <p className="profile-bio">{applicant.bio}</p>
              ) : (
                <p className="profile-bio profile-empty">No bio provided</p>
              )}
            </div>

            <dl className="profile-details">
              {details.map(({ label, value }) => (
                <div className="profile-detail" key={label}>
                  <dt>{label}</dt>
                  <dd>{value || <span className="profile-empty">Not provided</span>}</dd>
                </div>
              ))}
              {application && (
                <div className="profile-detail">
                  <dt>Applied for</dt>
                  <dd>
                    {application.job?.title}
                    {application.job?.company ? ` at ${application.job.company}` : ''}
                    {' — '}
                    {application.status}
                  </dd>
                </div>
              )}
            </dl>

            <section className="applicant-resume-section">
              <h4>Resume</h4>
              {resume ? (
                <>
                  <p>
                    {resume.originalName}
                    {formatFileSize(resume.size) && ` (${formatFileSize(resume.size)})`}
                  </p>
                  <button type="button" className="btn-secondary" onClick={handleViewResume}>
                    View Resume
                  </button>
                  <button type="button" className="btn-secondary" onClick={handleDownloadResume}>
                    Download Resume
                  </button>
                </>
              ) : (
                <p className="profile-empty">No resume attached to this application.</p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default ApplicantProfilePanel;
