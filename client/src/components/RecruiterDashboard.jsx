import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { createJob, deleteJob, fetchMyJobs, updateJob } from '../api/jobApi';
import { formatPostedDate, formatUpdatedDate } from '../utils/dateUtils';
import JobPostingForm from './JobPostingForm';

function RecruiterDashboard({ onBack }) {
  const { token } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('list'); // 'list' | 'create' | 'edit'
  const [editingJob, setEditingJob] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

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

  return (
    <main className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <h1>Recruiter Dashboard</h1>
          <button type="button" className="btn-secondary" onClick={onBack}>
            Back to Home
          </button>
        </div>

        {mode === 'list' && (
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
                  onClick={() => handleDelete(job)}
                >
                  Delete Posting
                </button>
                
                </div>
              ))}
            </div>
          </>
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
