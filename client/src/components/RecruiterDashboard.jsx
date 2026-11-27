import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { createJob, deleteJob, fetchMyJobs, fetchJobApplications, updateJob } from '../api/jobApi';
import { fetchApplicationResumeBlobUrl, updateApplicationStatus } from '../api/applicationApi';
import { formatPostedDate, formatUpdatedDate } from '../utils/dateUtils';
import { downloadBlobUrl } from '../utils/fileDownload';
import JobPostingForm from './JobPostingForm';
import ApplicantProfilePanel from './ApplicantProfilePanel';

const APPLICATION_STATUS_OPTIONS = ['Applied', 'Under Review', 'Interview', 'Offered', 'Rejected'];
const LOCKED_FROM_EARLY_STAGES = new Set(['Interview', 'Offered', 'Rejected']);
const EARLY_STAGES = new Set(['Applied', 'Under Review']);

function getAvailableStatusOptions(currentStatus) {
  if (LOCKED_FROM_EARLY_STAGES.has(currentStatus)) {
    return APPLICATION_STATUS_OPTIONS.filter((status) => !EARLY_STAGES.has(status));
  }
  return APPLICATION_STATUS_OPTIONS;
}

// The resume, status, and profile action cells shared by both application
// tables (the per-job view and the all-applications overview).
function ApplicationActionCells({ application, onDownloadResume, onStatusChange, onViewProfile }) {
  const applicantName = application.applicant?.name || 'Applicant';
  const availableOptions = getAvailableStatusOptions(application.status);

  return (
    <>
      <td>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onDownloadResume(application)}
        >
          Download Resume
        </button>
      </td>

      <td>
        <select
          className="recruiter-status-select"
          value={application.status}
          onChange={(e) => onStatusChange(application, e.target.value)}
          aria-label={`Application status for ${applicantName}`}
        >
          {availableOptions.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        {application.status === 'Interview' && application.interviewDate && (
          <div style={{ fontSize: '0.75rem', color: '#7c3aed', marginTop: '4px', fontWeight: '500' }}>
            Scheduled: {new Date(application.interviewDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        )}
      </td>

      <td>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onViewProfile(application._id)}
          aria-label={`View profile of ${applicantName}`}
        >
          View Profile
        </button>
      </td>
    </>
  );
}

// Loads one posting's applications and tags each with the job it belongs to.
// Kept outside the component so the loading effect does not nest functions too deeply (SonarCloud S2004).
async function fetchApplicationsWithJob(token, job) {
  const jobApplications = await fetchJobApplications(token, job._id);
  return jobApplications.map((application) => ({
    ...application,
    jobTitle: job.title,
    jobCompany: job.company,
  }));
}

function RecruiterDashboard({ currentView, onBack, selectedApplicationId = null }) {
  const { token } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('list'); // 'list' | 'create' | 'edit'
  const [editingJob, setEditingJob] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedJob, setSelectedJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [allRecruiterApplications, setAllRecruiterApplications] = useState([]);
  const [allApplicationsLoading, setAllApplicationsLoading] = useState(false);
  const [allApplicationsError, setAllApplicationsError] = useState('');
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsError, setApplicationsError] = useState('');
  const [applicationSearch, setApplicationSearch] = useState('');
  const [applicationStatusFilter, setApplicationStatusFilter] = useState('All');
  const [profileApplicationId, setProfileApplicationId] = useState(null);

  // Interview scheduling modal state
  const [interviewTarget, setInterviewTarget] = useState(null);
  const [interviewDateTime, setInterviewDateTime] = useState('');

  useEffect(() => {
    const loadJobs = async () => {
      if (!token) {
        setJobs([]);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const data = await fetchMyJobs(token);
        setJobs(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadJobs();
  }, [token, refreshToken]);

  useEffect(() => {
    if (currentView !== 'recruiter-applications' || !token) return;

    let cancelled = false;

    const loadAllApplications = async () => {
      setAllApplicationsLoading(true);
      setAllApplicationsError('');

      try {
        const recruiterJobs = await fetchMyJobs(token);

        const applicationGroups = await Promise.all(
          recruiterJobs.map((job) => fetchApplicationsWithJob(token, job))
        );

        if (!cancelled) {
          setAllRecruiterApplications(applicationGroups.flat());
        }
      } catch (err) {
        if (!cancelled) {
          setAllApplicationsError(err.message);
        }
      } finally {
        if (!cancelled) {
          setAllApplicationsLoading(false);
        }
      }
    };

    loadAllApplications();

    return () => {
      cancelled = true;
    };
  }, [currentView, token, refreshToken]);

  useEffect(() => {
    if (!selectedApplicationId || currentView !== 'recruiter-applications') return;
    document
      .getElementById(`recruiter-application-${selectedApplicationId}`)
      ?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [selectedApplicationId, currentView, allRecruiterApplications]);

  const handleCreate = async (values) => {
    await createJob(token, values);
    setRefreshToken((n) => n + 1);
    setMode('list');
  };

  const handleUpdate = async (values) => {
    await updateJob(token, editingJob._id, values);
    setRefreshToken((n) => n + 1);
    setMode('list');
    setEditingJob(null);
  };

  const handleViewApplications = async (job) => {
    setSelectedJob(job);
    setApplications([]);
    setApplicationsLoading(true);
    setApplicationsError('');
    setMode('applications');

    try {
      const data = await fetchJobApplications(token, job._id);
      setApplications(data);
    } catch (err) {
      setApplicationsError(err.message);
    } finally {
      setApplicationsLoading(false);
    }
  };

  const submitStatusChange = async (applicationId, newStatus, interviewDate = null) => {
    setApplicationsError('');
    setAllApplicationsError('');
    try {
      const result = await updateApplicationStatus(
        token,
        applicationId,
        newStatus,
        interviewDate
      );

      const applyPatch = (application) =>
        application._id === applicationId
          ? {
              ...application,
              status: result.application.status,
              interviewDate: result.application.interviewDate || null,
            }
          : application;

      setApplications((currentApplications) => currentApplications.map(applyPatch));
      setAllRecruiterApplications((currentApplications) => currentApplications.map(applyPatch));
    } catch (err) {
      setApplicationsError(err.message);
      setAllApplicationsError(err.message);
    }
  };

  const handleStatusChange = async (application, newStatus) => {
    if (newStatus === 'Interview') {
      setInterviewTarget(application);
      setInterviewDateTime(
        application.interviewDate
          ? new Date(application.interviewDate).toISOString().slice(0, 16)
          : ''
      );
      return;
    }
    await submitStatusChange(application._id, newStatus, null);
  };

  const handleConfirmInterview = async (e) => {
    e.preventDefault();
    if (!interviewTarget) return;
    const isoDate = interviewDateTime ? new Date(interviewDateTime).toISOString() : null;
    await submitStatusChange(interviewTarget._id, 'Interview', isoDate);
    setInterviewTarget(null);
    setInterviewDateTime('');
  };

  const handleDownloadResume = async (application) => {
    try {
      const blobUrl = await fetchApplicationResumeBlobUrl(token, application._id, { download: true });
      downloadBlobUrl(blobUrl, application.resume?.originalName || 'resume');
    } catch (err) {
      setApplicationsError(err.message);
    }
  };

  const handleDelete = async (job) => {
    if (!window.confirm(`Delete "${job.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteJob(token, job._id);
      setJobs((currentJobs) =>
        currentJobs.filter((item) => item._id !== job._id)
      );
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredRecruiterApplications = allRecruiterApplications.filter(
    (application) => {
      const search = applicationSearch.toLowerCase();

      const matchesSearch = [
        application.applicant?.name,
        application.applicant?.email,
        application.jobTitle,
      ].some((value) =>
        (value || '').toLowerCase().includes(search)
      );

      const matchesStatus =
        applicationStatusFilter === 'All' ||
        application.status === applicationStatusFilter;

      return matchesSearch && matchesStatus;
    }
  );

  const showAllApplicationsTable =
    !allApplicationsLoading && !allApplicationsError && allRecruiterApplications.length > 0;

  return (
    <main className="profile-page recruiter-dashboard">
      <div className="profile-container">
        <div className="profile-header">
          <h1>Recruiter Dashboard</h1>
          <button type="button" className="btn-secondary" onClick={onBack}>
            Back to Home
          </button>
        </div>

        {mode === 'list' && currentView !== 'recruiter-applications' && (
          <>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setEditingJob(null);
                setMode('create');
              }}
            >
              Post a New Job
            </button>

            {loading && <p>Loading your job postings...</p>}
            {error && <p className="resume-error">{error}</p>}

            {!loading && !error && jobs.length === 0 && (
              <p className="resume-hint">You haven&apos;t posted any jobs yet.</p>
            )}

            <div className="job-cards">
              {jobs.map((job) => (
                <div key={job._id} className="job-card">
                  <h3>{job.title}</h3>
                  <p><strong>Company:</strong> {job.company}</p>
                  <p><strong>Location:</strong> {job.location} | <strong>Category:</strong> {job.category}</p>
                  <p className="job-card-dates">
                    {formatPostedDate(job.createdAt)}
                    {job.updatedAt && job.updatedAt !== job.createdAt && (
                      <> &middot; {formatUpdatedDate(job.updatedAt)}</>
                    )}
                  </p>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setEditingJob(job);
                      setMode('edit');
                    }}
                  >
                    Edit Posting
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleViewApplications(job)}
                  >
                    View Applications
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleDelete(job)}
                  >
                    Delete Posting
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {currentView === 'recruiter-applications' && mode === 'list' && (
          <section className="recruiter-applications-overview">
            <h2>Applications</h2>
            <p>Review applicants and manage their application statuses.</p>
            <div className="recruiter-application-filters">
              <input
                type="search"
                placeholder="Search applicants, emails, or jobs..."
                value={applicationSearch}
                onChange={(e) => setApplicationSearch(e.target.value)}
                aria-label="Search applications"
              />

              <select
                value={applicationStatusFilter}
                onChange={(e) => setApplicationStatusFilter(e.target.value)}
                aria-label="Filter by application status"
              >
                <option value="All">All Statuses</option>
                {APPLICATION_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            {allApplicationsLoading ? (
              <p>Loading applications...</p>
            ) : null}
            {!allApplicationsLoading && allApplicationsError ? (
              <p role="alert" className="resume-error">
                {allApplicationsError}
              </p>
            ) : null}
            {!allApplicationsLoading && !allApplicationsError && allRecruiterApplications.length === 0 ? (
              <p>No applications received yet.</p>
            ) : null}
            {showAllApplicationsTable ? (
              <div className="applications-table-wrapper">
                <table className="applications-table recruiter-applications-table">
                  <thead>
                    <tr>
                      <th>Applicant</th>
                      <th>Job Title</th>
                      <th>Email</th>
                      <th>Date Applied</th>
                      <th>Resume</th>
                      <th>Status</th>
                      <th>Profile</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRecruiterApplications.map((application) => (
                      <tr
                        key={application._id}
                        id={`recruiter-application-${application._id}`}
                        aria-current={application._id === selectedApplicationId ? 'true' : undefined}
                        style={{
                          backgroundColor:
                            application._id === selectedApplicationId ? '#eef2ff' : undefined,
                        }}
                      >
                        <td>{application.applicant?.name || 'Applicant'}</td>
                        <td>{application.jobTitle}</td>
                        <td>{application.applicant?.email || 'Unavailable'}</td>
                        <td>
                          {new Date(application.createdAt).toLocaleDateString()}
                        </td>
                        <ApplicationActionCells
                          application={application}
                          onDownloadResume={handleDownloadResume}
                          onStatusChange={handleStatusChange}
                          onViewProfile={setProfileApplicationId}
                        />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        )}

        {mode === 'applications' && selectedJob && (
          <section>
            <h2>Applications for {selectedJob.title}</h2>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setMode('list');
                setSelectedJob(null);
              }}
            >
              Back to Postings
            </button>

            {applicationsLoading && <p>Loading applications...</p>}

            {applicationsError && (
              <p className="resume-error">{applicationsError}</p>
            )}

            {!applicationsLoading && !applicationsError && applications.length === 0 && (
              <p>No applications received yet.</p>
            )}

            {!applicationsLoading && !applicationsError && applications.length > 0 && (
              <div className="applications-table-wrapper">
                <table className="applications-table recruiter-applications-table">
                  <thead>
                    <tr>
                      <th>Applicant</th>
                      <th>Email</th>
                      <th>Location</th>
                      <th>Date Applied</th>
                      <th>Resume</th>
                      <th>Application Status</th>
                      <th>Profile</th>
                    </tr>
                  </thead>

                  <tbody>
                    {applications.map((application) => (
                      <tr key={application._id}>
                        <td>
                          <strong>
                            {application.applicant?.name || 'Applicant'}
                          </strong>
                        </td>

                        <td>{application.applicant?.email || 'Unavailable'}</td>

                        <td>{application.applicant?.location || 'Not provided'}</td>

                        <td>
                          {new Date(application.createdAt).toLocaleDateString()}
                        </td>

                        <ApplicationActionCells
                          application={application}
                          onDownloadResume={handleDownloadResume}
                          onStatusChange={handleStatusChange}
                          onViewProfile={setProfileApplicationId}
                        />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {mode === 'create' && (
          <JobPostingForm
            submitLabel="Post Job"
            onSubmit={handleCreate}
            onCancel={() => setMode('list')}
          />
        )}

        {mode === 'edit' && editingJob && (
          <JobPostingForm
            initialValues={editingJob}
            submitLabel="Save Changes"
            onSubmit={handleUpdate}
            onCancel={() => {
              setMode('list');
              setEditingJob(null);
            }}
          />
        )}

        {profileApplicationId && (
          <ApplicantProfilePanel
            applicationId={profileApplicationId}
            onClose={() => setProfileApplicationId(null)}
          />
        )}

        {interviewTarget && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
          >
            <form
              onSubmit={handleConfirmInterview}
              style={{
                backgroundColor: '#fff',
                borderRadius: '10px',
                maxWidth: '420px',
                width: '90%',
                padding: '24px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              }}
            >
              <h3 style={{ margin: '0 0 8px 0' }}>Schedule Interview</h3>
              <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '0.875rem' }}>
                Choose the interview date and time for{' '}
                <strong>{interviewTarget.applicant?.name || 'this candidate'}</strong>.
              </p>

              <div style={{ marginBottom: '16px' }}>
                <label
                  htmlFor="dashboard-interview-datetime"
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' }}
                >
                  Interview Date &amp; Time *
                </label>
                <input
                  id="dashboard-interview-datetime"
                  type="datetime-local"
                  required
                  value={interviewDateTime}
                  onChange={(e) => setInterviewDateTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setInterviewTarget(null);
                    setInterviewDateTime('');
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm &amp; Send Invite
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

export default RecruiterDashboard;