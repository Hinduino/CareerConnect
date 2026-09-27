import { useEffect, useRef, useState } from 'react';
import {
  fetchResumeMetadata,
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
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const loadResume = async () => {
    if (!token) {
      setResume(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchResumeMetadata(token);
      setResume(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
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
      const data = resume
        ? await replaceResume(token, file)
        : await uploadResume(token, file);
      setResume(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !resume) return;
    if (!window.confirm('Delete your uploaded resume?')) return;

    setLoading(true);
    setError('');
    try {
      await deleteResume(token);
      setResume(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // View/Download can't rely on a plain <a href> since the request needs an
  // Authorization header. Instead we fetch the file ourselves and open the
  // resulting blob URL, which behaves the same way from the user's POV.
  const handleViewOrDownload = async (download) => {
    if (!token) return;
    setError('');
    try {
      const blobUrl = await fetchResumeBlobUrl(token, { download });
      const link = document.createElement('a');
      link.href = blobUrl;
      if (download) {
        link.download = resume?.originalName || 'resume';
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

  return (
    <section className="resume-manager-section" id="resume">
      <h3>My Resume</h3>

      {!isAuthenticated && (
        <p className="resume-hint">Log in to upload and manage your resume.</p>
      )}

      {error && <p className="resume-error">{error}</p>}

      {isAuthenticated && loading && <p>Loading...</p>}

      {isAuthenticated && !loading && resume && (
        <div className="resume-card">
          <div>
            <strong>{resume.originalName}</strong>
            <div className="resume-meta">
              {formatFileSize(resume.size)} &middot; uploaded{' '}
              {new Date(resume.uploadedAt).toLocaleDateString()}
            </div>
          </div>
          <div className="resume-actions">
            <button type="button" onClick={() => handleViewOrDownload(false)}>
              View
            </button>
            <button type="button" onClick={() => handleViewOrDownload(true)}>
              Download
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              Replace
            </button>
            <button type="button" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>
      )}

      {isAuthenticated && !loading && !resume && !error && (
        <button type="button" onClick={() => fileInputRef.current?.click()}>
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

