import { useEffect, useRef, useState } from 'react';
import {
  fetchResumeMetadata,
  getResumeFileUrl,
  uploadResume,
  replaceResume,
  deleteResume,
} from '../api/resumeApi';

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];
const MAX_FILE_SIZE_MB = 5;

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ResumeManager() {
  // TEMPORARY: there is no auth system merged yet, so we ask for a Mongo
  // user id directly. Once the auth branch lands, replace this with the
  // id from the authenticated user's session (e.g. useAuth().user.id) and
  // remove the id input below.
  const [userId, setUserId] = useState(
    () => localStorage.getItem('careerconnect_userId') || ''
  );
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('careerconnect_userId', userId);
  }, [userId]);

  const loadResume = async (id) => {
    if (!id) {
      setResume(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchResumeMetadata(id);
      setResume(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResume(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
    if (!file || !userId) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = resume
        ? await replaceResume(userId, file)
        : await uploadResume(userId, file);
      setResume(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!userId || !resume) return;
    if (!window.confirm('Delete your uploaded resume?')) return;

    setLoading(true);
    setError('');
    try {
      await deleteResume(userId);
      setResume(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="resume-manager-section" id="resume">
      <h3>My Resume</h3>

      <div className="resume-user-id-field">
        <label htmlFor="resume-user-id">User ID (temporary, until login is added)</label>
        <input
          id="resume-user-id"
          type="text"
          placeholder="Paste your MongoDB user id"
          value={userId}
          onChange={(e) => setUserId(e.target.value.trim())}
        />
      </div>

      {!userId && (
        <p className="resume-hint">Enter your user id to manage your resume.</p>
      )}

      {error && <p className="resume-error">{error}</p>}

      {userId && loading && <p>Loading...</p>}

      {userId && !loading && resume && (
        <div className="resume-card">
          <div>
            <strong>{resume.originalName}</strong>
            <div className="resume-meta">
              {formatFileSize(resume.size)} &middot; uploaded{' '}
              {new Date(resume.uploadedAt).toLocaleDateString()}
            </div>
          </div>
          <div className="resume-actions">
            <a
              href={getResumeFileUrl(userId)}
              target="_blank"
              rel="noopener noreferrer"
            >
              View
            </a>
            <a href={getResumeFileUrl(userId, { download: true })}>Download</a>
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              Replace
            </button>
            <button type="button" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>
      )}

      {userId && !loading && !resume && !error && (
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
