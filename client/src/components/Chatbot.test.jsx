const { fireEvent, render, screen, waitFor } = require('@testing-library/react');

jest.mock('../api/chatApi', () => ({
  sendChatMessage: jest.fn(),
}));
jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const Chatbot = require('./Chatbot').default;
const { sendChatMessage } = require('../api/chatApi');
const { useAuth } = require('../context/AuthContext');

describe('CareerConnect chatbot', () => {
  beforeEach(() => {
    sendChatMessage.mockReset();
    useAuth.mockReturnValue({ token: 'session-token' });
  });

  it('opens from the floating launcher and sends a message to the assistant', async () => {
    sendChatMessage.mockResolvedValue('Try tailoring your resume to each role.');
    render(<Chatbot />);

    fireEvent.click(screen.getByRole('button', { name: 'Open CareerConnect chat' }));
    expect(screen.getByRole('region', { name: 'CareerConnect AI chat' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Your message'), {
      target: { value: 'How can I improve my resume?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(screen.getByText('How can I improve my resume?')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Try tailoring your resume to each role.')).toBeInTheDocument();
    });
    expect(sendChatMessage).toHaveBeenCalledWith([
      expect.objectContaining({ role: 'assistant' }),
      { role: 'user', content: 'How can I improve my resume?' },
    ], 'session-token', null);
  });

  it('expands to full screen and returns to the floating panel', () => {
    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open CareerConnect chat' }));

    const panel = screen.getByRole('region', { name: 'CareerConnect AI chat' });
    fireEvent.click(screen.getByRole('button', { name: 'Enter full screen' }));
    expect(panel).toHaveClass('chatbot-panel-fullscreen');

    fireEvent.click(screen.getByRole('button', { name: 'Exit full screen' }));
    expect(panel).not.toHaveClass('chatbot-panel-fullscreen');
  });

  it('attaches a document to the next chat message', async () => {
    sendChatMessage.mockResolvedValue('The document summarizes your experience.');
    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open CareerConnect chat' }));

    const document = new File(['resume text'], 'resume.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    fireEvent.change(screen.getByLabelText('Choose a document to share'), {
      target: { files: [document] },
    });
    expect(screen.getByText('resume.docx')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Your message'), {
      target: { value: 'Summarize my resume.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(sendChatMessage).toHaveBeenCalledWith(
        expect.any(Array),
        'session-token',
        document
      );
    });
    expect(screen.getByText('resume.docx')).toBeInTheDocument();
  });

  it('shows API errors and leaves the failed message visible', async () => {
    sendChatMessage.mockRejectedValue(new Error('The chat assistant is not configured yet'));
    render(<Chatbot />);

    fireEvent.click(screen.getByRole('button', { name: 'Open CareerConnect chat' }));
    fireEvent.change(screen.getByLabelText('Your message'), {
      target: { value: 'Hello' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The chat assistant is not configured yet'
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
