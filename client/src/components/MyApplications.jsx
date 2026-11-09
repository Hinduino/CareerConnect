import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { fetchMyApplications } from '../api/applicationApi';

function MyApplications() {
  const { token } = useAuth();
  const [activeStatus, setActiveStatus] = useState('All');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const statuses = [
    'All',
    'Applied',
    'Under Review',
    'Interview',
    'Offered',
    'Rejected',
  ];
  useEffect(() => {
    let cancelled = false;

    async function loadApplications() {
      try {
        const data = await fetchMyApplications(token);

        if (!cancelled) {
          setApplications(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadApplications();

    return () => {
      cancelled = true;
    };
  }, [token]);
  const filteredApplications =
  activeStatus === 'All'
    ? applications
    : applications.filter(
        (application) => application.status === activeStatus
      );
  // Calculate application statistics from real application data.
  const applicationStats = {
    total: applications.length,
    applied: applications.filter((app) => app.status === 'Applied').length,
    underReview: applications.filter((app) => app.status === 'Under Review').length,
    interview: applications.filter((app) => app.status === 'Interview').length,
    offered: applications.filter((app) => app.status === 'Offered').length,
    rejected: applications.filter((app) => app.status === 'Rejected').length,
  };
  return (
    <main className="applications-page">
      <div className="applications-container">
        <header className="applications-header">
          <h1>My Applications</h1>
          <p>Track your job applications and their progress.</p>
        </header>

        <nav className="applications-filters" aria-label="Application status filters">
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              className={`status-filter ${activeStatus === status ? 'active' : ''}`}
              onClick={() => setActiveStatus(status)}
              aria-pressed={activeStatus === status}
            >
              {status} ({
                status === 'All'
                  ? applicationStats.total
                  : applications.filter((app) => app.status === status).length
              })
            </button>
          ))}
        </nav>

        <section className="applications-content">
          <h2>Applications</h2>

          {loading ? (
            <p>Loading your applications...</p>
          ) : error ? (
            <p role="alert">Error: {error}</p>
          ) : applications.length === 0 ? (
            <p>You haven&apos;t applied to any jobs yet.</p>
          ) : filteredApplications.length === 0 ? (
  <p>No applications found with the &quot;{activeStatus}&quot; status.</p>
) : (
  <div className="applications-table-wrapper">
    <table className="applications-table">
      <thead>
        <tr>
          <th>Job Title</th>
          <th>Company</th>
          <th>Date Applied</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {filteredApplications.map((application) => (
          <tr key={application._id}>
            <td>{application.job?.title || 'Job unavailable'}</td>
            <td>{application.job?.company || 'N/A'}</td>
            <td>
              {new Date(application.createdAt).toLocaleDateString()}
            </td>
            <td>
              <span  className={`application-status status-${application.status.toLowerCase().replace(/\s+/g, '-')}`} >
                {application.status}
              </span>
            </td>
            <td>
              <span className="application-action-placeholder">
                —
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
        </section>
      </div>
    </main>
  );
}

export default MyApplications;