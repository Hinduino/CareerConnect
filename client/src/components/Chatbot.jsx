import { useState } from 'react';
import { sendChatMessage } from '../api/chatApi';
import { useAuth } from '../context/AuthContext';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm the CareerConnect AI assistant. Ask me about job searching, applications, resumes, or interviews."
};

function Chatbot() {
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

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
      const reply = await sendChatMessage(conversation, token);
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
            <button
              className="chatbot-send"
              type="submit"
              disabled={isSending || !draft.trim()}
            >
              Send
            </button>
          </form>
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
