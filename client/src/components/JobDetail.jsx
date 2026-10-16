import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { applyToJob, fetchMyApplications } from '../api/applicationApi';
import { formatPostedDate } from '../utils/dateUtils';

function formatAppliedDate(dateString) {
    return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric',
    });
}

function JobDetail({ jobId, onBack }) {
    const { token, user, isAuthenticated } = useAuth();
    const isJobSeeker = isAuthenticated && user?.role === 'job_seeker';

    const [job, setJob] = useState(null);
    const [error, setError] = useState('');
    // The job seeker's application to this job, once it exists.
    const [application, setApplication] = useState(null);
    // True when the application was submitted just now, on this page.
    const [justApplied, setJustApplied] = useState(false);
    const [applying, setApplying] = useState(false);
    const [applyError, setApplyError] = useState('');

    useEffect(() => {
        const fetchJobDetail = async () => {
            try {
                const response = await fetch(`http://localhost:3000/api/jobs/${jobId}`);
                const data = await response.json();

                if (response.ok) {
                    setJob(data);
                } else {
                    setError(data.error || 'Failed to load job details');
                }
            } catch (err) {
                console.error('Network Error:', err);
                setError('Failed to connect to the server.');
            }
        };

        if (jobId) {
            fetchJobDetail();
        }
    }, [jobId]);

    // If the job seeker already applied to this job, show that instead of
    // the Apply button, so they don't try to apply twice.
    useEffect(() => {
        if (!jobId || !isJobSeeker || !token) return;

        fetchMyApplications(token)
            .then((applications) => {
                const existing = applications.find((app) => app.job?._id === jobId);
                if (existing) setApplication(existing);
            })
            .catch(() => {
                // Not critical: the Apply button still works, and the server
                // rejects duplicate applications anyway.
            });
    }, [jobId, isJobSeeker, token]);

    const handleApply = async () => {
        setApplying(true);
        setApplyError('');
        try {
            const saved = await applyToJob(token, jobId);
            setApplication(saved);
            setJustApplied(true);
        } catch (err) {
            if (err.status === 409) {
                // Applied before, e.g. from another tab: load that application.
                try {
                    const applications = await fetchMyApplications(token);
                    const existing = applications.find((app) => app.job?._id === jobId);
                    if (existing) {
                        setApplication(existing);
                        return;
                    }
                } catch {
                    // Fall through to showing the server's message.
                }
            }
            setApplyError(err.message);
        } finally {
            setApplying(false);
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

            <h2>{job.title}</h2>
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

            <div className="job-apply-area">
                {application ? (
                    <div className="application-confirmation" role="status">
                        <h3>{justApplied ? 'Application submitted!' : 'You have already applied'}</h3>
                        <p>
                            {justApplied ? 'Your application for ' : 'You applied for '}
                            <strong>{job.title}</strong> at <strong>{job.company}</strong> on{' '}
                            {formatAppliedDate(application.createdAt)}.
                        </p>
                        <p>Current status: <strong>{application.status}</strong></p>
                    </div>
                ) : isJobSeeker ? (
                    <>
                        {applyError && <p className="resume-error" role="alert">{applyError}</p>}
                        <button
                            type="button"
                            className="btn-primary"
                            onClick={handleApply}
                            disabled={applying}
                        >
                            {applying ? 'Submitting...' : 'Apply Now'}
                        </button>
                    </>
                ) : !isAuthenticated ? (
                    <p className="resume-hint">Log in as a job seeker to apply for this job.</p>
                ) : null}
            </div>
        </section>
    );
}

export default JobDetail;