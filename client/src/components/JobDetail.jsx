import { useEffect, useState } from 'react';
import { formatPostedDate } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';
import { fetchJob } from '../api/jobApi';
import { fetchResumes } from '../api/resumeApi';
import { fetchApplicationStatus, submitApplication, cancelApplication } from '../api/applicationApi';
import { fetchFavoriteJobIds, toggleFavoriteJob } from '../api/favoriteApi';

function JobDetail({ jobId, onBack }) {
    const [job, setJob] = useState(null);
    const [error, setError] = useState('');

    const { token, isAuthenticated, user } = useAuth();
    const isJobSeeker = isAuthenticated && user?.role === 'job_seeker';

    // Favorite state (SCRUM-281)
    const [isFavorited, setIsFavorited] = useState(false);
    const [favoriteLoading, setFavoriteLoading] = useState(false);

    // Whether the current user already has an application on file for this job.
    const [applied, setApplied] = useState(false);
    const [applicationId, setApplicationId] = useState(null);
    const [statusLoading, setStatusLoading] = useState(false);

    // The applicant's saved resumes, used to populate the resume picker.
    const [resumes, setResumes] = useState([]);
    const [selectedResumeId, setSelectedResumeId] = useState('');
    const [resumesLoading, setResumesLoading] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [actionError, setActionError] = useState('');

    useEffect(() => {
        const loadJob = async () => {
            try {
                const data = await fetchJob(jobId);
                setJob(data);
            } catch (err) {
                setError(err.message || 'Failed to load job details');
            }
        };

        if (jobId) {
            loadJob();
        }
    }, [jobId]);

    useEffect(() => {
        const loadFavoriteState = async () => {
            if (!isJobSeeker || !token || !jobId) {
                setIsFavorited(false);
                return;
            }
            try {
                const ids = await fetchFavoriteJobIds(token);
                setIsFavorited(ids.includes(jobId));
            } catch {
                setIsFavorited(false);
            }
        };
        loadFavoriteState();
    }, [isJobSeeker, token, jobId]);

    const handleToggleFavorite = async () => {
        if (!token || !jobId) return;
        setFavoriteLoading(true);
        try {
            const res = await toggleFavoriteJob(token, jobId);
            setIsFavorited(res.favorited);
        } catch (err) {
            setActionError(err.message || 'Failed to update favorite status.');
        } finally {
            setFavoriteLoading(false);
        }
    };

    useEffect(() => {
        const loadStatus = async () => {
            if (!isAuthenticated || !jobId) {
                setApplied(false);
                setApplicationId(null);
                return;
            }
            setStatusLoading(true);
            try {
                const data = await fetchApplicationStatus(token, jobId);
                setApplied(data.applied);
                setApplicationId(data.applicationId);
            } catch {
                setApplied(false);
                setApplicationId(null);
            } finally {
                setStatusLoading(false);
            }
        };
        loadStatus();
    }, [isAuthenticated, token, jobId]);

    useEffect(() => {
        const loadResumes = async () => {
            if (!isAuthenticated || applied) {
                setResumes([]);
                return;
            }
            setResumesLoading(true);
            try {
                const data = await fetchResumes(token);
                setResumes(data);
                setSelectedResumeId((current) => current || data[0]?.id || '');
            } catch {
                setResumes([]);
            } finally {
                setResumesLoading(false);
            }
        };
        loadResumes();
    }, [isAuthenticated, token, applied]);

    const handleApply = async () => {
        if (!isAuthenticated) {
            setActionError('Please log in or sign up to apply for this job.');

            const loginInput = document.querySelector(
                '.navbar-actions input[type="email"]'
            );

            if (loginInput) {
                loginInput.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
                loginInput.focus({ preventScroll: true });
            }

            return;
        }
        if (!selectedResumeId) {
            setActionError('Please select a resume before applying.');
            return;
        }

        setIsSubmitting(true);
        setActionError('');

        try {
            const data = await submitApplication(token, jobId, selectedResumeId);
            setApplied(true);
            setApplicationId(data.application._id);
        } catch (err) {
            setActionError(err.message || 'Failed to submit application.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = async () => {
        if (!applicationId) return;
        if (!window.confirm('Cancel this application?')) return;

        setIsCancelling(true);
        setActionError('');

        try {
            await cancelApplication(token, applicationId);
            setApplied(false);
            setApplicationId(null);
        } catch (err) {
            setActionError(err.message || 'Failed to cancel application.');
        } finally {
            setIsCancelling(false);
        }
    };

    if (error) return (
        <div style={{ padding: '20px' }}>
            <p>{error}</p>
            <button onClick={onBack}>Back to Jobs</button>
        </div>
    );

    if (!job) return <p style={{ padding: '20px' }}>Loading job details...</p>;

    return (
        <section className="job-detail-section" style={{ padding: '20px' }}>
            <button onClick={onBack} style={{ marginBottom: '20px' }}>&larr; Back to Job List</button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <h2 style={{ margin: 0 }}>{job.title}</h2>
                {isJobSeeker && (
                    <button
                        type="button"
                        onClick={handleToggleFavorite}
                        disabled={favoriteLoading}
                        aria-pressed={isFavorited}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '6px',
                            border: isFavorited ? '1px solid #f59e0b' : '1px solid #cbd5e1',
                            backgroundColor: isFavorited ? '#fef3c7' : '#ffffff',
                            color: isFavorited ? '#b45309' : '#334155',
                            fontWeight: '600',
                            cursor: 'pointer',
                        }}
                    >
                        {isFavorited ? '★ Saved to Favorites' : '☆ Save Job'}
                    </button>
                )}
            </div>

            <h4>{job.company} - {job.location}</h4>
            <span style={{ background: '#eee', padding: '5px' }}>{job.category}</span>
            <p className="job-card-dates">{formatPostedDate(job.createdAt)}</p>

            <div style={{ marginTop: '20px' }}>
                <h3>Job Description</h3>
                <p>{job.description}</p>
            </div>

            <div style={{ marginTop: '20px' }}>
                <h3>Requirements</h3>
                <p>{job.requirements}</p>
            </div>

            <div style={{ marginTop: '20px' }}>
                {actionError && (
                    <p style={{ color: 'red', marginBottom: '10px' }}>{actionError}</p>
                )}
                {!isAuthenticated ? (
                    <div>
                        <button
                            type="button"
                            className="btn-primary"
                            onClick={handleApply}
                        >
                            Apply Now
                        </button>
                        <p className="resume-hint">
                            You can browse jobs without an account.
                            Log in or sign up above to submit an application.
                        </p>
                    </div>
                ) : statusLoading ? (
                    <p>Checking application status...</p>
                ) : applied ? (
                    <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isCancelling}
                        className="btn-danger"
                    >
                        {isCancelling ? 'Cancelling...' : 'Cancel Application'}
                    </button>
                ) : resumesLoading ? (
                    <p>Loading your resumes...</p>
                ) : resumes.length === 0 ? (
                    <p className="resume-hint">
                        Upload a resume in your profile before applying for this job.
                    </p>
                ) : (
                    <div>
                        <label htmlFor="resume-select" style={{ display: 'block', marginBottom: '8px' }}>
                            Select a resume to apply with
                        </label>
                        <select
                            id="resume-select"
                            value={selectedResumeId}
                            onChange={(e) => setSelectedResumeId(e.target.value)}
                            style={{ marginBottom: '12px', padding: '6px' }}
                        >
                            {resumes.map((resume) => (
                                <option key={resume.id} value={resume.id}>
                                    {resume.originalName}
                                </option>
                            ))}
                        </select>
                        <div>
                            <button
                                type="button"
                                onClick={handleApply}
                                disabled={isSubmitting}
                                className="btn-primary"
                                style={{ cursor: isSubmitting ? 'wait' : 'pointer' }}
                            >
                                {isSubmitting ? 'Submitting...' : 'Apply Now'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

export default JobDetail;