import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  fetchRecruiterPostings,
  createJobPosting,
  updateJobPosting,
  toggleArchiveJobPosting,
  fetchApplicantsForJob,
} from '../api/jobManagementApi';
import { updateApplicationStatus, fetchApplicationResumeBlobUrl } from '../api/applicationApi';

const STATUS_OPTIONS = ['Applied', 'Under Review', 'Interview', 'Offered', 'Rejected'];

function RecruiterPostings() {
  const { token } = useAuth();
  const authToken = token || localStorage.getItem('token');

  const [postings, setPostings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Form modal state (Create / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    category: '',
    description: '',
    requirements: '',
  });

  // Candidate Drilldown View
  const [selectedJob, setSelectedJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateSort, setDateSort] = useState('desc');

  const refreshPostings = () => setReloadKey((prev) => prev + 1);

  // Fetch postings on load
  useEffect(() => {
    let isSubscribed = true;

    async function loadPostings() {
      if (!authToken) {
        if (isSubscribed) setLoading(false);
        return;
      }
      try {
        const data = await fetchRecruiterPostings(authToken);
        if (isSubscribed) {
          setPostings(data || []);
          setError('');
        }
      } catch (err) {
        if (isSubscribed) setError(err.message || 'Unable to load postings.');
      } finally {
        if (isSubscribed) setLoading(false);
      }
    }

    loadPostings();
    return () => {
      isSubscribed = false;
    };
  }, [authToken, reloadKey]);

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingJob(null);
    setFormData({
      title: '',
      company: '',
      location: '',
      category: 'Software Engineering',
      description: '',
      requirements: '',
    });
    setModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (job, e) => {
    e.stopPropagation();
    setEditingJob(job);
    setFormData({
      title: job.title || '',
      company: job.company || '',
      location: job.location || '',
      category: job.category || '',
      description: job.description || '',
      requirements: job.requirements || '',
    });
    setModalOpen(true);
  };

  // Save Create or Edit
  const handleSaveJob = async (e) => {
    e.preventDefault();
    try {
      if (editingJob) {
        await updateJobPosting(authToken, editingJob._id, formData);
      } else {
        await createJobPosting(authToken, formData);
      }
      setModalOpen(false);
      refreshPostings();
    } catch (err) {
      alert(err.message || 'Error saving job posting.');
    }
  };

  // Toggle Archive
  const handleToggleArchive = async (jobId, e) => {
    e.stopPropagation();
    try {
      await toggleArchiveJobPosting(authToken, jobId);
      refreshPostings();
      if (selectedJob && selectedJob._id === jobId) {
        setSelectedJob(null);
      }
    } catch (err) {
      alert(err.message || 'Error archiving posting.');
    }
  };

  // Drilldown: View Applicants for Posting
  const handleSelectJob = async (job) => {
    setSelectedJob(job);
    setLoadingApplicants(true);
    try {
      const data = await fetchApplicantsForJob(authToken, job._id);
      setApplicants(data || []);
    } catch (err) {
      alert(err.message || 'Error fetching applicants.');
    } finally {
      setLoadingApplicants(false);
    }
  };

  // Recruiter updates candidate status
  const handleUpdateStatus = async (applicationId, newStatus) => {
    try {
      await updateApplicationStatus(authToken, applicationId, newStatus);
      const data = await fetchApplicantsForJob(authToken, selectedJob._id);
      setApplicants(data || []);
      refreshPostings();
    } catch (err) {
      alert(err.message || 'Error updating status.');
    }
  };

  // Download resume blob
  const handleDownloadResume = async (applicationId) => {
    try {
      const url = await fetchApplicationResumeBlobUrl(authToken, applicationId, { download: true });
      const a = document.createElement('a');
      a.href = url;
      a.download = 'resume.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert(err.message || 'Error downloading resume.');
    }
  };

  // Filtered & sorted applicants
  const filteredApplicants = applicants
    .filter((app) => (statusFilter === 'All' ? true : app.status === statusFilter))
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateSort === 'asc' ? dateA - dateB : dateB - dateA;
    });

  return (
    <div style={{ maxWidth: '1100px', margin: '30px auto', padding: '0 20px', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2>Job Postings Management</h2>
          <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Create, edit, archive postings, and review applicants per job.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          style={{
            padding: '10px 18px',
            backgroundColor: '#4f46e5',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          + Create New Job
        </button>
      </div>

      {loading && <p style={{ color: '#64748b' }}>Loading job postings...</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      {/* Postings Table */}
      {!loading && !error && postings.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
          <p style={{ color: '#64748b', margin: 0 }}>You haven&apos;t created any job postings yet.</p>
        </div>
      )}

      {!loading && postings.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '30px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: '#fff' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#475569' }}>Job Title</th>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#475569' }}>Location &amp; Category</th>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#475569' }}>Applications</th>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#475569' }}>Status</th>
                <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#475569', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {postings.map((job) => (
                <tr
                  key={job._id}
                  onClick={() => handleSelectJob(job)}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    backgroundColor: selectedJob?._id === job._id ? '#eef2ff' : '#fff',
                  }}
                >
                  <td style={{ padding: '14px 16px', fontWeight: '600', color: '#1e293b' }}>
                    {job.title}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '0.875rem' }}>
                    {job.location} &bull; {job.category}
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: '600', color: '#4f46e5' }}>
                    {job.applicantCount || 0} received
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        backgroundColor: job.isArchived ? '#f1f5f9' : '#dcfce7',
                        color: job.isArchived ? '#64748b' : '#15803d',
                        border: `1px solid ${job.isArchived ? '#cbd5e1' : '#bbf7d0'}`,
                      }}
                    >
                      {job.isArchived ? 'Archived' : 'Active'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleOpenEdit(job, e)}
                      style={{
                        marginRight: '8px',
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => handleToggleArchive(job._id, e)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        backgroundColor: job.isArchived ? '#dbeafe' : '#fee2e2',
                        color: job.isArchived ? '#1e40af' : '#b91c1c',
                        border: `1px solid ${job.isArchived ? '#bfdbfe' : '#fca5a5'}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      {job.isArchived ? 'Unarchive' : 'Archive'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drilldown: Candidate List for Selected Posting */}
      {selectedJob && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0 }}>Applicants for: {selectedJob.title}</h3>
              <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                Review candidates, change statuses, and download resumes.
              </p>
            </div>
            {/* Filter and Sort controls */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
              >
                <option value="All">All Statuses</option>
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
                <option value="Offer Declined">Offer Declined</option>
              </select>

              <select
                value={dateSort}
                onChange={(e) => setDateSort(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          </div>

          {loadingApplicants && <p style={{ color: '#64748b' }}>Loading applicants...</p>}

          {!loadingApplicants && filteredApplicants.length === 0 && (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '20px 0' }}>
              No applicants found matching criteria for this posting.
            </p>
          )}

          {!loadingApplicants && filteredApplicants.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.85rem' }}>
                  <th style={{ padding: '10px 12px' }}>Candidate Name</th>
                  <th style={{ padding: '10px 12px' }}>Email</th>
                  <th style={{ padding: '10px 12px' }}>Date Applied</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Resume</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplicants.map((app) => (
                  <tr key={app._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px' }}>{app.applicant?.name || 'Applicant'}</td>
                    <td style={{ padding: '12px', color: '#64748b' }}>{app.applicant?.email || 'N/A'}</td>
                    <td style={{ padding: '12px', color: '#64748b', fontSize: '0.85rem' }}>
                      {new Date(app.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <select
                        value={app.status}
                        onChange={(e) => handleUpdateStatus(app._id, e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                      >
                        {STATUS_OPTIONS.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                        {app.status === 'Offer Declined' && (
                          <option value="Offer Declined">Offer Declined</option>
                        )}
                      </select>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDownloadResume(app._id)}
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <form
            onSubmit={handleSaveJob}
            style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              maxWidth: '550px',
              width: '90%',
              padding: '24px',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0' }}>{editingJob ? 'Edit Job Posting' : 'Create New Job Posting'}</h3>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' }}>
                Job Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' }}>
                  Company *
                </label>
                <input
                  type="text"
                  required
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' }}>
                  Location *
                </label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' }}>
                Category *
              </label>
              <input
                type="text"
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' }}>
                Description *
              </label>
              <textarea
                required
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '4px' }}>
                Requirements
              </label>
              <textarea
                rows={2}
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontWeight: '600' }}
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default RecruiterPostings;