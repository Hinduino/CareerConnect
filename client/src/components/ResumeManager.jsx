import { useEffect, useRef, useState } from 'react';
import {
  fetchResumes,
  fetchResumeBlobUrl,
  uploadResume,
  replaceResume,
  deleteResume,
} from '../api/resumeApi';
import { useAuth } from '../context/AuthContext';

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];
const MAX_FILE_SIZE_MB = 5;

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ResumeManager() {
  const { token, isAuthenticated } = useAuth();
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOthers, setShowOthers] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);
  // null while uploading a new resume, otherwise the id of the resume being replaced.
  const replacingIdRef = useRef(null);

  const [mostRecent, ...otherResumes] = resumes;
  const mostRecentId = mostRecent?.id;

  useEffect(() => {
    const loadResumes = async () => {
      if (!token) {
        setResumes([]);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const data = await fetchResumes(token);
        setResumes(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadResumes();
  }, [token]);

  // Whenever the most recent resume changes, fetch its bytes once and keep a
  // blob URL around so it can be rendered inline (an <iframe> for PDFs)
  // instead of only being reachable through the View/Download buttons.
  useEffect(() => {
    let activeUrl = null;
    let cancelled = false;

    const loadPreview = async () => {
      if (!token || !mostRecentId) {
        setPreviewUrl(null);
        return;
      }
      try {
        const url = await fetchResumeBlobUrl(token, mostRecentId, { download: false });
        activeUrl = url;
        if (!cancelled) setPreviewUrl(url);
      } catch {
        if (!cancelled) setPreviewUrl(null);
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [token, mostRecentId]);

  const validateFile = (file) => {
    const extension = file.name
      .slice(file.name.lastIndexOf('.'))
      .toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return 'Only PDF, DOC, and DOCX files are allowed.';
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`;
    }
    return null;
  };

  const openFilePicker = (resumeId = null) => {
    replacingIdRef.current = resumeId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    const replacingId = replacingIdRef.current;
    replacingIdRef.current = null;
    event.target.value = ''; // allow re-selecting the same file later
    if (!file || !token) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (replacingId) {
        const updated = await replaceResume(token, replacingId, file);
        setResumes((current) => current.map((r) => (r.id === replacingId ? updated : r)));
      } else {
        const created = await uploadResume(token, file);
        setResumes((current) => [created, ...current]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (resume) => {
    if (!token) return;
    if (!window.confirm(`Delete "${resume.originalName}"?`)) return;

    setError('');
    try {
      await deleteResume(token, resume.id);
      setResumes((current) => current.filter((item) => item.id !== resume.id));
    } catch (err) {
      setError(err.message);
    }
  };

  // View/Download can't rely on a plain <a href> since the request needs an
  // Authorization header. Instead we fetch the file ourselves and open the
  // resulting blob URL, which behaves the same way from the user's POV.
  const handleViewOrDownload = async (resume, download) => {
    if (!token) return;
    setError('');
    try {
      const blobUrl = await fetchResumeBlobUrl(token, resume.id, { download });
      const link = document.createElement('a');
      link.href = blobUrl;
      if (download) {
        link.download = resume.originalName || 'resume';
      } else {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Give the browser a moment to open/save the file before revoking.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (err) {
      setError(err.message);
    }
  };

  const renderResumeCard = (resume) => (
    <div className="resume-card" key={resume.id}>
      <div>
        <strong>{resume.originalName}</strong>
        <div className="resume-meta">{formatFileSize(resume.size)}</div>
      </div>
      <div className="resume-actions">
        <button type="button" className="btn-secondary btn-small" onClick={() => handleViewOrDownload(resume, false)}>
          View
        </button>
        <button type="button" className="btn-secondary btn-small" onClick={() => handleViewOrDownload(resume, true)}>
          Download
        </button>
        <button type="button" className="btn-secondary btn-small" onClick={() => openFilePicker(resume.id)}>
          Replace
        </button>
        <button type="button" className="btn-danger btn-small" onClick={() => handleDelete(resume)}>
          Delete
        </button>
      </div>
    </div>
  );

  return (
    <section className="resume-manager-section" id="resume">
      <h3>My Resume</h3>

      {!isAuthenticated && (
        <p className="resume-hint">Log in to upload and manage your resumes.</p>
      )}

      {error && <p className="resume-error">{error}</p>}

      {isAuthenticated && loading && <p>Loading...</p>}

      {isAuthenticated && !loading && resumes.length === 0 && !error && (
        <p className="resume-hint">You haven&apos;t saved a resume yet.</p>
      )}

      {isAuthenticated && !loading && mostRecent && (
        <>
          {renderResumeCard(mostRecent)}

          <div className="resume-preview">
            {mostRecent.contentType === 'application/pdf' && previewUrl ? (
              <iframe
                src={previewUrl}
                title={`Preview of ${mostRecent.originalName}`}
                className="resume-preview-frame"
              />
            ) : (
              <div className="resume-preview-placeholder">
                <span className="resume-preview-icon" aria-hidden="true">📄</span>
                <p className="resume-preview-name">{mostRecent.originalName}</p>
                <p className="resume-meta">
                  Preview isn&apos;t available for this file type. Use View or Download above.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {isAuthenticated && !loading && otherResumes.length > 0 && (
        <>
          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={() => setShowOthers((current) => !current)}
          >
            {showOthers
              ? 'Hide other resumes'
              : `Show other resumes (${otherResumes.length})`}
          </button>
          {showOthers && otherResumes.map(renderResumeCard)}
        </>
      )}

      {isAuthenticated && (
        <button type="button" className="btn-primary" onClick={() => openFilePicker()}>
          Upload Resume
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </section>
  );
}

export default ResumeManager;
