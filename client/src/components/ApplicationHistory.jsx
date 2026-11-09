import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchMyApplications, cancelApplication, declineJobOffer } from '../api/applicationApi';
import ApplicationAnalytics from './ApplicationAnalytics';


const STATUS_STYLES = {
  Applied: { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' },
  'under review': { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
  'Under Review': { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
  Interview: { bg: '#ede9fe', text: '#6d28d9', border: '#ddd6fe' },
  Interviewing: { bg: '#ede9fe', text: '#6d28d9', border: '#ddd6fe' },
  Offered: { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' },
  Rejected: { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' },
  'Offer Declined': { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  Cancelled: { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' },
};

function ApplicationHistory() {
  const { user, token } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const authToken = token || localStorage.getItem('token');

  // Trigger reload on mutation without calling setState directly inside the effect
  const refreshList = () => setReloadKey((prev) => prev + 1);

  useEffect(() => {
    let isSubscribed = true;

    async function loadData() {
      if (!authToken) {
        if (isSubscribed) setLoading(false);
        return;
      }

      try {
        const data = await fetchMyApplications(authToken);
        if (isSubscribed) {
          setApplications(data || []);
          setError('');
        }
      } catch (err) {
        if (isSubscribed) {
          console.error('Error fetching applications:', err);
          setError(err.message || 'Unable to load applications.');
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isSubscribed = false;
    };
  }, [authToken, user, reloadKey]);

  const handleDeclineOffer = async (e, applicationId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to decline this job offer?')) return;

    setActionLoading(true);
    try {
      await declineJobOffer(authToken, applicationId);
      refreshList();
      if (selectedApp && selectedApp._id === applicationId) setSelectedApp(null);
    } catch (err) {
      alert(err.message || 'Failed to decline offer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelApplication = async (e, applicationId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to withdraw this application?')) return;

    setActionLoading(true);
    try {
      await cancelApplication(authToken, applicationId);
      refreshList();
      if (selectedApp && selectedApp._id === applicationId) setSelectedApp(null);
    } catch (err) {
      alert(err.message || 'Failed to cancel application');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '30px auto', padding: '0 20px', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>My Applications</h2>
        <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
          Total Submitted: <strong>{applications.length}</strong>
        </span>
      </div>

    { /* SCRUM-318: Job Seeker Application Analytics */}
      {!loading && !error && applications.length > 0 && (
        <ApplicationAnalytics applications={applications} />
      )}

      {loading && <p style={{ color: '#64748b' }}>Loading your application history...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      {!loading && !error && applications.length === 0 && (
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
          <h3>No applications found</h3>
          <p style={{ marginTop: '8px' }}>You haven&apos;t submitted any job applications yet.</p>
        </div>
      )}

      {!loading && applications.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: '#ffffff' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#475569' }}>Job Title</th>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#475569' }}>Company &amp; Description</th>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#475569' }}>Application Date</th>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#475569' }}>Status</th>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#475569', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => {
                const conf = STATUS_STYLES[app.status] || { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
                const isOffered = app.status === 'Offered';
                const canCancel = !['Rejected', 'Offer Declined', 'Cancelled'].includes(app.status);

                return (
                  <tr
                    key={app._id}
                    onClick={() => setSelectedApp(app)}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                  >
                    <td style={{ padding: '14px 16px', fontWeight: '600', color: '#1e293b' }}>
                      {app.job?.title || 'Job Unavailable'}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '0.875rem', maxWidth: '350px' }}>
                      <strong>{app.job?.company || 'Company'}</strong> &mdash;{' '}
                      <span style={{ display: 'inline-block', maxWidth: '220px', verticalAlign: 'bottom', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {app.job?.description || 'No description available'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                      {new Date(app.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          backgroundColor: conf.bg,
                          color: conf.text,
                          border: `1px solid ${conf.border}`,
                        }}
                      >
                        {app.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {isOffered && (
                        <button
                          disabled={actionLoading}
                          onClick={(e) => handleDeclineOffer(e, app._id)}
                          style={{
                            marginRight: '8px',
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fca5a5',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          Decline Offer
                        </button>
                      )}
                      {canCancel && (
                        <button
                          disabled={actionLoading}
                          onClick={(e) => handleCancelApplication(e, app._id)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          Withdraw
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedApp && (
        <div
          onClick={() => setSelectedApp(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              maxWidth: '600px',
              width: '90%',
              padding: '24px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem' }}>{selectedApp.job?.title}</h3>
                <h4 style={{ margin: 0, color: '#64748b', fontWeight: '500' }}>
                  {selectedApp.job?.company} {selectedApp.job?.location ? `• ${selectedApp.job.location}` : ''}
                </h4>
              </div>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  backgroundColor: STATUS_STYLES[selectedApp.status]?.bg || '#f1f5f9',
                  color: STATUS_STYLES[selectedApp.status]?.text || '#475569',
                  border: `1px solid ${STATUS_STYLES[selectedApp.status]?.border || '#cbd5e1'}`,
                }}
              >
                {selectedApp.status}
              </span>
            </div>

            <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '0.85rem' }}>
              <p style={{ margin: '0 0 4px 0' }}>
                <strong>Applied On:</strong> {new Date(selectedApp.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div style={{ marginTop: '16px' }}>
              <h5 style={{ margin: '0 0 6px 0' }}>Job Description</h5>
              <p style={{ margin: 0, color: '#334155', fontSize: '0.9rem', lineHeight: '1.4', maxHeight: '180px', overflowY: 'auto' }}>
                {selectedApp.job?.description || 'No description provided.'}
              </p>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setSelectedApp(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApplicationHistory;