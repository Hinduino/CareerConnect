import { useEffect, useRef, useState } from 'react';
import { sendChatMessage } from '../api/chatApi';
import { fetchResumes } from '../api/resumeApi';
import { useAuth } from '../context/AuthContext';
import ChatMessageContent from './ChatMessageContent';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm the CareerConnect AI assistant. Ask me about job searching, applications, resumes, or interviews. You can also ask me to compare your profile and resume with active jobs for tailored recommendations."
};

const DOCUMENT_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function validateDocument(file) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || DOCUMENT_TYPES[extension] !== file.type) {
    return 'Only matching PDF, DOC, and DOCX files are allowed.';
  }
  if (file.size > 5 * 1024 * 1024) {
    return 'Document is too large. Maximum size is 5MB.';
  }
  return null;
}

function getResumeOptionLabels(resumes) {
  const nameCounts = new Map();
  resumes.forEach((resume) => {
    nameCounts.set(resume.originalName, (nameCounts.get(resume.originalName) || 0) + 1);
  });

  const labels = resumes.map((resume) => {
    if (nameCounts.get(resume.originalName) === 1) return resume.originalName;

    const createdAt = resume.createdAt ? new Date(resume.createdAt) : null;
    const uploadedAt = createdAt && !Number.isNaN(createdAt.getTime())
      ? ` — uploaded ${createdAt.toLocaleString()}`
      : '';
    return `${resume.originalName}${uploadedAt}`;
  });

  const labelCounts = new Map();
  labels.forEach((label) => {
    labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
  });

  return labels.map((label, index) => (
    labelCounts.get(label) > 1 ? `${label} (ID ${resumes[index].id})` : label
  ));
}

function Chatbot() {
  const { token } = useAuth();
  const fileInputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [document, setDocument] = useState(null);
  const [profileResumeData, setProfileResumeData] = useState(null);
  const [profileResumeSelection, setProfileResumeSelection] = useState(null);
  const currentProfileResumeData = profileResumeData?.token === token ? profileResumeData : null;
  const profileResumes = currentProfileResumeData?.resumes || [];
  const profileResumeOptionLabels = getResumeOptionLabels(profileResumes);
  const profileResumesLoading = Boolean(isOpen && token && !currentProfileResumeData);
  const profileResumesLoadError = Boolean(currentProfileResumeData?.error);
  const profileResumeId = profileResumeSelection?.token === token
    ? profileResumeSelection.id
    : '';
  const selectedProfileResumeIndex = profileResumes.findIndex((resume) => resume.id === profileResumeId);
  const selectedProfileResumeLabel = selectedProfileResumeIndex >= 0
    ? profileResumeOptionLabels[selectedProfileResumeIndex]
    : '';

  useEffect(() => {
    if (!isOpen || !token) return undefined;

    let active = true;
    fetchResumes(token)
      .then((resumes) => {
        if (active) setProfileResumeData({ token, resumes, error: '' });
      })
      .catch((resumeError) => {
        if (active) setProfileResumeData({ token, resumes: [], error: resumeError.message });
      });

    return () => {
      active = false;
    };
  }, [isOpen, token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;

    const nextMessages = [...messages, { role: 'user', content }];
    const conversation = nextMessages.slice(-20);
    setMessages(nextMessages);
    setDraft('');
    setError('');
    setIsSending(true);

    try {
      const reply = await sendChatMessage(conversation, token, document, profileResumeId);
      setMessages((currentMessages) => [
        ...currentMessages,
        { role: 'assistant', content: reply }
      ]);
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={`chatbot${isFullscreen ? ' chatbot-fullscreen' : ''}`}>
      {isOpen && (
        <section
          className={`chatbot-panel${isFullscreen ? ' chatbot-panel-fullscreen' : ''}`}
          aria-label="CareerConnect AI chat"
        >
          <header className="chatbot-header">
            <div>
              <p className="chatbot-eyebrow">CAREERCONNECT</p>
              <h2>AI Assistant</h2>
            </div>
            <div className="chatbot-header-actions">
              <button
                className="chatbot-header-button"
                type="button"
                onClick={() => setIsFullscreen((fullscreen) => !fullscreen)}
                aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
                title={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
              >
                <span aria-hidden="true">{isFullscreen ? '⤢' : '⛶'}</span>
              </button>
              <button
                className="chatbot-header-button chatbot-close"
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsFullscreen(false);
                }}
                aria-label="Close chat"
                title="Close chat"
              >
                ×
              </button>
            </div>
          </header>

          <div className="chatbot-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div
                className={`chatbot-message chatbot-message-${message.role}`}
                key={`${message.role}-${index}`}
              >
                {message.role === 'assistant'
                  ? <ChatMessageContent content={message.content} />
                  : message.content}
              </div>
            ))}
            {isSending && (
              <p className="chatbot-status" role="status">Assistant is typing...</p>
            )}
            {error && <p className="chatbot-error" role="alert">{error}</p>}
          </div>

          <form className="chatbot-form" onSubmit={handleSubmit}>
            <label className="chatbot-sr-only" htmlFor="chatbot-input">Your message</label>
            <input
              id="chatbot-input"
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask a career question..."
              maxLength={2000}
              disabled={isSending}
            />
            <input
              ref={fileInputRef}
              className="chatbot-sr-only"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              aria-label="Choose a document to share"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                if (file) {
                  const validationError = validateDocument(file);
                  if (validationError) {
                    setDocument(null);
                    setError(validationError);
                    event.target.value = '';
                    return;
                  }
                }
                if (!file) {
                  setDocument(null);
                  setError('');
                  return;
                }

                setError('');
                setDocument(file);
                setProfileResumeSelection(null);
              }}
              disabled={isSending}
            />
            <button
              className="chatbot-attach"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              aria-label="Attach a document"
              title="Attach a PDF, DOC, or DOCX document"
            >
              Attach
            </button>
            <button
              className="chatbot-send"
              type="submit"
              disabled={isSending || !draft.trim()}
            >
              Send
            </button>
          </form>
          {token && (
            <div className="chatbot-resume">
              <label htmlFor="chatbot-profile-resume">Resume from your profile</label>
              <select
                id="chatbot-profile-resume"
                value={profileResumeId}
                onChange={(event) => {
                  setProfileResumeSelection(event.target.value
                    ? { token, id: event.target.value }
                    : null);
                  if (event.target.value) {
                    setDocument(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }
                }}
                disabled={isSending || profileResumesLoading || profileResumesLoadError || profileResumes.length === 0 || Boolean(document)}
              >
                <option value="">
                  {profileResumesLoading
                    ? 'Loading saved resumes...'
                    : profileResumesLoadError
                      ? 'Saved resumes unavailable'
                      : 'Do not use a saved resume'}
                </option>
                {profileResumes.map((resume, index) => (
                  <option key={resume.id} value={resume.id}>
                    {profileResumeOptionLabels[index]}
                  </option>
                ))}
              </select>
              {!profileResumesLoading && !profileResumesLoadError && profileResumes.length === 0 && (
                <span>No saved resumes found in your profile.</span>
              )}
              {profileResumesLoadError && (
                <span className="chatbot-error" role="alert">{currentProfileResumeData.error}</span>
              )}
            </div>
          )}
          {document && (
            <div className="chatbot-document">
              <span title={document.name}>{document.name}</span>
              <button
                type="button"
                onClick={() => {
                  setDocument(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                aria-label="Remove attached document"
              >
                ×
              </button>
            </div>
          )}
          {profileResumeId && (
            <div className="chatbot-document">
              <span>
                Using profile resume: {selectedProfileResumeLabel}
              </span>
              <button
                type="button"
                onClick={() => setProfileResumeSelection(null)}
                aria-label="Stop using profile resume"
              >
                ×
              </button>
            </div>
          )}
          <p className="chatbot-document-note">
            PDF, DOC, and DOCX up to 5MB. The original file is not forwarded; extracted resume text (up to 12,000 characters) and relevant CareerConnect context are sent to Kilo AI.
          </p>
        </section>
      )}

      {!isOpen && (
        <button
          className="chatbot-launcher"
          type="button"
          onClick={() => setIsOpen(true)}
          aria-expanded={false}
          aria-label="Open CareerConnect chat"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-4 2v-6a7.5 7.5 0 1 1 17-3.5Z" />
            <path d="m12 7.5.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3Z" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default Chatbot;
