import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { createJob, deleteJob, fetchMyJobs, fetchJobApplications, updateJob } from '../api/jobApi';
import { fetchApplicationResumeBlobUrl,  updateApplicationStatus, } from '../api/applicationApi';
import { formatPostedDate, formatUpdatedDate } from '../utils/dateUtils';
import JobPostingForm from './JobPostingForm';

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
        recruiterJobs.map(async (job) => {
          const jobApplications = await fetchJobApplications(token, job._id);

          return jobApplications.map((application) => ({
            ...application,
            jobTitle: job.title,
            jobCompany: job.company,
          }));
        })
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

  // Load applications for the selected job posting.
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
  // Update an applicant's status and refresh the displayed status.
  const handleStatusChange = async (applicationId, newStatus) => {
    setApplicationsError('');
    try {
      const result = await updateApplicationStatus(
        token,
        applicationId,
        newStatus
      );

      setApplications((currentApplications) =>
        currentApplications.map((application) =>
          application._id === applicationId
            ? { ...application, status: result.application.status }
            : application
        )
      );
      setAllRecruiterApplications((currentApplications) =>
        currentApplications.map((application) =>
          application._id === applicationId
            ? { ...application, status: result.application.status }
            : application
        )
      );
    } catch (err) {
      setApplicationsError(err.message);
    }
  };
  // Fetch the resume attached to an application and open/download it. Can't
  // rely on a plain <a href> since the request needs an Authorization header.
  const handleDownloadResume = async (application) => {
    try {
      const blobUrl = await fetchApplicationResumeBlobUrl(token, application._id, { download: true });
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = application.resume?.originalName || 'resume';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (err) {
      setApplicationsError(err.message);
    }
  };

  // Delete a job posting after recruiter confirmation.
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
                <option value="Applied">Applied</option>
                <option value="Under Review">Under Review</option>
                <option value="Interview">Interview</option>
                <option value="Offered">Offered</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            {allApplicationsLoading ? (
              <p>Loading applications...</p>
            ) : allApplicationsError ? (
              <p role="alert" className="resume-error">
                {allApplicationsError}
              </p>
            ) : allRecruiterApplications.length === 0 ? (
              <p>No applications received yet.</p>
            ) : (
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
                        <td>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleDownloadResume(application)}
                          >
                            Download Resume
                          </button>
                        </td>
                        <td>
                          <select
                            className="recruiter-status-select"
                            value={application.status}
                            onChange={(e) =>
                              handleStatusChange(application._id, e.target.value)
                            }
                            aria-label={`Application status for ${application.applicant?.name || 'Applicant'}`}
                          >
                            <option value="Applied">Applied</option>
                            <option value="Under Review">Under Review</option>
                            <option value="Interview">Interview</option>
                            <option value="Offered">Offered</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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

                        <td>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleDownloadResume(application)}
                          >
                            Download Resume
                          </button>
                        </td>

                        <td>
                          <select
                            className="recruiter-status-select"
                            value={application.status}
                            onChange={(e) =>
                              handleStatusChange(application._id, e.target.value)
                            }
                            aria-label={`Application status for ${application.applicant?.name || 'Applicant'}`}
                          >
                            <option value="Applied">Applied</option>
                            <option value="Under Review">Under Review</option>
                            <option value="Interview">Interview</option>
                            <option value="Offered">Offered</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                        </td>
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
      </div>
    </main>
  );
}

export default RecruiterDashboard;
