import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchMyApplications } from '../api/applicationApi';

function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric',
    });
}

// "Under Review" -> "status-under-review", used to colour each status.
function statusClass(status) {
    return `status-badge status-${String(status).toLowerCase().replace(/\s+/g, '-')}`;
}

function MyApplications({ onBrowseJobs }) {
    const { token } = useAuth();
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Bumped by the Refresh button to load the latest statuses again.
    const [refreshCount, setRefreshCount] = useState(0);

    useEffect(() => {
        const loadApplications = async () => {
            if (!token) {
                setApplications([]);
                setLoading(false);
                return;
            }
            setLoading(true);
            setError('');
            try {
                setApplications(await fetchMyApplications(token));
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        loadApplications();
    }, [token, refreshCount]);

    return (
        <main className="profile-page">
            <div className="profile-container">
                <div className="profile-header">
                    <h1>My Applications</h1>
                    <button type="button" className="btn-secondary" onClick={() => setRefreshCount((n) => n + 1)} disabled={loading}>
                        Refresh
                    </button>
                </div>

                {loading && <p>Loading your applications...</p>}
                {error && <p className="resume-error" role="alert">{error}</p>}

                {!loading && !error && applications.length === 0 && (
                    <div>
                        <p className="resume-hint">You haven&apos;t applied to any jobs yet.</p>
                        <button type="button" className="btn-primary" onClick={onBrowseJobs}>
                            Browse Jobs
                        </button>
                    </div>
                )}

                {!loading && !error && applications.length > 0 && (
                    <ul className="application-list">
                        {applications.map((application) => {
                            const history = application.statusHistory || [];
                            const lastChange = history[history.length - 1];

                            return (
                                <li key={application._id} className="job-card application-card">
                                    <div className="application-card-header">
                                        <div>
                                            <h3>{application.job ? application.job.title : 'Job no longer available'}</h3>
                                            {application.job && (
                                                <p>{application.job.company} &middot; {application.job.location}</p>
                                            )}
                                        </div>
                                        <span className={statusClass(application.status)}>{application.status}</span>
                                    </div>

                                    <p className="job-card-dates">
                                        Applied on {formatDate(application.createdAt)}
                                        {lastChange && history.length > 1 && (
                                            <> &middot; Last updated {formatDate(lastChange.changedAt)}</>
                                        )}
                                    </p>

                                    <details className="status-history">
                                        <summary>Status history ({history.length})</summary>
                                        <ol>
                                            {history.map((entry, index) => (
                                                <li key={`${entry.status}-${index}`}>
                                                    <span className={statusClass(entry.status)}>{entry.status}</span>
                                                    {' '}on {formatDate(entry.changedAt)}
                                                </li>
                                            ))}
                                        </ol>
                                    </details>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </main>
    );
}

export default MyApplications;