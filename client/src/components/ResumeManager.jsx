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
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  

  useEffect(() => {
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
    loadResume();
  }, [token]);

  // Whenever we have a resume on file, fetch its bytes once and keep a blob
  // URL around so it can be rendered inline (an <iframe> for PDFs) instead
  // of only being reachable through the View/Download buttons.
  useEffect(() => {
    let activeUrl = null;
    let cancelled = false;

    const loadPreview = async () => {
      if (!token || !resume) {
        setPreviewUrl(null);
        return;
      }
      try {
        const url = await fetchResumeBlobUrl(token, { download: false });
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
  }, [token, resume]);

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
        <>
          <div className="resume-card">
            <div>
              <strong>{resume.originalName}</strong>
              <div className="resume-meta">
                {formatFileSize(resume.size)}
              </div>
            </div>
            <div className="resume-actions">
              <button type="button" className="btn-secondary btn-small" onClick={() => handleViewOrDownload(false)}>
                View
              </button>
              <button type="button" className="btn-secondary btn-small" onClick={() => handleViewOrDownload(true)}>
                Download
              </button>
              <button type="button" className="btn-secondary btn-small" onClick={() => fileInputRef.current?.click()}>
                Replace
              </button>
              <button type="button" className="btn-danger btn-small" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>

          <div className="resume-preview">
            {resume.contentType === 'application/pdf' && previewUrl ? (
              <iframe
                src={previewUrl}
                title={`Preview of ${resume.originalName}`}
                className="resume-preview-frame"
              />
            ) : (
              <div className="resume-preview-placeholder">
                <span className="resume-preview-icon" aria-hidden="true">📄</span>
                <p className="resume-preview-name">{resume.originalName}</p>
                <p className="resume-meta">
                  Preview isn&apos;t available for this file type. Use View or Download above.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {isAuthenticated && !loading && !resume && !error && (
        <button type="button" className="btn-primary" onClick={() => fileInputRef.current?.click()}>
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
