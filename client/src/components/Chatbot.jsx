import { useRef, useState } from 'react';
import { sendChatMessage } from '../api/chatApi';
import { useAuth } from '../context/AuthContext';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm the CareerConnect AI assistant. Ask me about job searching, applications, resumes, or interviews."
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
      const reply = await sendChatMessage(conversation, token, document);
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
              <p
                className={`chatbot-message chatbot-message-${message.role}`}
                key={`${message.role}-${index}`}
              >
                {message.content}
              </p>
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
          <p className="chatbot-document-note">
            PDF, DOC, and DOCX up to 5MB. Up to 12,000 text characters are sent to Kilo AI while attached.
          </p>
        </section>
      )}

      <button
        className="chatbot-launcher"
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close CareerConnect chat' : 'Open CareerConnect chat'}
      >
        <span aria-hidden="true">{isOpen ? '×' : 'Chat'}</span>
      </button>
    </div>
  );
}

export default Chatbot;
