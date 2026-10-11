import { useEffect, useRef, useState } from 'react';
import {
  fetchProfilePictureMetadata,
  fetchProfilePictureBlobUrl,
  uploadProfilePicture,
  deleteProfilePicture,
} from '../api/profilePictureApi';
import { useAuth } from '../context/AuthContext';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const MAX_FILE_SIZE_MB = 5;

function getInitials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function ProfilePicture({ name }) {
  const { token, isAuthenticated } = useAuth();
  const [pictureUrl, setPictureUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;

    const loadPicture = async () => {
      if (!token) {
        setPictureUrl(null);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const metadata = await fetchProfilePictureMetadata(token);
        if (!metadata) {
          if (!cancelled) setPictureUrl(null);
          return;
        }
        const url = await fetchProfilePictureBlobUrl(token);
        objectUrl = url;
        if (!cancelled) setPictureUrl(url);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPicture();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token]);

  const validateFile = (file) => {
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return 'Only JPG, PNG, GIF, and WEBP images are allowed.';
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`;
    }
    return null;
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !token) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await uploadProfilePicture(token, file);
      const url = await fetchProfilePictureBlobUrl(token);
      setPictureUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!token || !pictureUrl) return;
    if (!window.confirm('Remove your profile picture?')) return;

    setLoading(true);
    setError('');
    try {
      await deleteProfilePicture(token);
      setPictureUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-picture-block">
      <div className="profile-picture-frame">
        {pictureUrl ? (
          <img src={pictureUrl} alt={`${name || 'User'}'s profile`} className="profile-picture-img" />
        ) : (
          <div className="profile-picture-placeholder">{getInitials(name)}</div>
        )}
      </div>

      {isAuthenticated && (
        <div className="profile-picture-actions">
          <button
            type="button"
            className="btn-primary btn-small"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            {pictureUrl ? 'Change Photo' : 'Upload Photo'}
          </button>
          {pictureUrl && (
            <button
              type="button"
              className="btn-secondary btn-small"
              onClick={handleRemove}
              disabled={loading}
            >
              Remove
            </button>
          )}
        </div>
      )}

      {error && <p className="resume-error">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}

export default ProfilePicture;
