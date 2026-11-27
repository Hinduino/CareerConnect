const { fireEvent, render, screen, waitFor } = require('@testing-library/react');

jest.mock('../api/chatApi', () => ({
  sendChatMessage: jest.fn(),
}));
jest.mock('../api/resumeApi', () => ({
  fetchResumes: jest.fn(),
}));
jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const Chatbot = require('./Chatbot').default;
const { sendChatMessage } = require('../api/chatApi');
const { fetchResumes } = require('../api/resumeApi');
const { useAuth } = require('../context/AuthContext');

describe('CareerConnect chatbot', () => {
  beforeEach(() => {
    sendChatMessage.mockReset();
    fetchResumes.mockReset().mockReturnValue(new Promise(() => {}));
    useAuth.mockReturnValue({ token: 'session-token' });
  });

  it('opens from the floating launcher and sends a message to the assistant', async () => {
    sendChatMessage.mockResolvedValue('Try tailoring your resume to each role.');
    render(<Chatbot />);

    const launcher = screen.getByRole('button', { name: 'Open CareerConnect chat' });
    expect(launcher.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(launcher);
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
    ], 'session-token', null, '');
  });

  it('renders formatted assistant responses with clear headings and callouts', async () => {
    sendChatMessage.mockResolvedValue([
      '## Resume Summary',
      'Your resume shows **strong experience** with *React* and `TypeScript`.',
      '',
      '> Add measurable outcomes to your recent projects.',
      '',
      '- Keep the skills section focused.',
    ].join('\n'));
    render(<Chatbot />);

    fireEvent.click(screen.getByRole('button', { name: 'Open CareerConnect chat' }));
    fireEvent.change(screen.getByLabelText('Your message'), {
      target: { value: 'Review my resume.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('heading', { name: 'Resume Summary' })).toBeInTheDocument();
    expect(screen.getByText('strong experience').tagName).toBe('STRONG');
    expect(screen.getByText('React').tagName).toBe('EM');
    expect(screen.getByText('TypeScript').tagName).toBe('CODE');
    expect(screen.getByText('Add measurable outcomes to your recent projects.').closest('blockquote'))
      .toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveTextContent('Keep the skills section focused.');
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

  it('shows only one close button while the chat is open', () => {
    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open CareerConnect chat' }));

    expect(screen.getAllByRole('button', { name: /close/i })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Open CareerConnect chat' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close chat' }));
    expect(screen.getByRole('button', { name: 'Open CareerConnect chat' })).toBeInTheDocument();
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
        document,
        ''
      );
    });
    expect(screen.getByText('resume.docx')).toBeInTheDocument();
  });

  it('disables the saved-resume selector while an uploaded document is attached', async () => {
    fetchResumes.mockResolvedValue([
      { id: 'resume-123', originalName: 'profile-resume.pdf' },
    ]);
    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open CareerConnect chat' }));

    const resumeSelect = await screen.findByLabelText('Resume from your profile');
    fireEvent.change(screen.getByLabelText('Choose a document to share'), {
      target: {
        files: [new File(['resume'], 'uploaded.pdf', { type: 'application/pdf' })],
      },
    });

    expect(resumeSelect).toBeDisabled();
  });

  it('lets the signed-in user select a saved profile resume for analysis', async () => {
    fetchResumes.mockResolvedValue([
      { id: 'resume-123', originalName: 'profile-resume.pdf' },
    ]);
    sendChatMessage.mockResolvedValue('Summary:\nExperienced frontend developer.\n\nStrengths:\n- Strong React skills.');
    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open CareerConnect chat' }));

    fireEvent.change(await screen.findByLabelText('Resume from your profile'), {
      target: { value: 'resume-123' },
    });
    expect(screen.getByText('Using profile resume: profile-resume.pdf')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Your message'), {
      target: { value: 'Review my resume.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(sendChatMessage).toHaveBeenCalledWith(
        expect.any(Array),
        'session-token',
        null,
        'resume-123'
      );
    });
    expect(screen.getByRole('heading', { name: 'Summary' })).toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveTextContent('Strong React skills.');
  });

  it('distinguishes saved resumes with duplicate filenames', async () => {
    const sameUploadTime = '2026-10-22T11:00:00.000Z';
    const olderUploadTime = '2026-10-21T11:00:00.000Z';
    fetchResumes.mockResolvedValue([
      { id: 'resume-latest', originalName: 'resume.pdf', createdAt: sameUploadTime },
      { id: 'resume-same-time', originalName: 'resume.pdf', createdAt: sameUploadTime },
      { id: 'resume-older', originalName: 'resume.pdf', createdAt: olderUploadTime },
    ]);
    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open CareerConnect chat' }));

    const resumeSelect = await screen.findByLabelText('Resume from your profile');
    const optionLabels = Array.from(resumeSelect.options)
      .slice(1)
      .map((option) => option.textContent);

    expect(optionLabels).toEqual([
      `resume.pdf — uploaded ${new Date(sameUploadTime).toLocaleString()} (ID resume-latest)`,
      `resume.pdf — uploaded ${new Date(sameUploadTime).toLocaleString()} (ID resume-same-time)`,
      `resume.pdf — uploaded ${new Date(olderUploadTime).toLocaleString()}`,
    ]);

    fireEvent.change(resumeSelect, { target: { value: 'resume-same-time' } });
    expect(screen.getByText(/Using profile resume: resume\.pdf/))
      .toHaveTextContent('ID resume-same-time');
  });

  it('rejects unsupported document extensions and MIME types', () => {
    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open CareerConnect chat' }));

    const unsupportedFile = new File(['script'], 'notes.txt', {
      type: 'text/plain',
    });
    fireEvent.change(screen.getByLabelText('Choose a document to share'), {
      target: { files: [unsupportedFile] },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Only matching PDF, DOC, and DOCX files are allowed.'
    );
    expect(screen.queryByText('notes.txt')).not.toBeInTheDocument();
    expect(sendChatMessage).not.toHaveBeenCalled();
  });

  it('rejects a supported extension with a mismatched MIME type', () => {
    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open CareerConnect chat' }));

    const mismatchedFile = new File(['resume'], 'resume.pdf', {
      type: 'application/msword',
    });
    fireEvent.change(screen.getByLabelText('Choose a document to share'), {
      target: { files: [mismatchedFile] },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Only matching PDF, DOC, and DOCX files are allowed.'
    );
    expect(screen.queryByText('resume.pdf')).not.toBeInTheDocument();
  });

  it('rejects a file with no extension', () => {
    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open CareerConnect chat' }));
    fireEvent.change(screen.getByLabelText('Choose a document to share'), {
      target: { files: [new File(['resume'], '', { type: 'application/pdf' })] },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Only matching PDF, DOC, and DOCX files are allowed.'
    );
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

  it('does not send an empty draft or a duplicate while a reply is pending', async () => {
    let resolveReply;
    sendChatMessage.mockReturnValue(new Promise((resolve) => {
      resolveReply = resolve;
    }));
    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open CareerConnect chat' }));

    const form = screen.getByLabelText('Your message').closest('form');
    fireEvent.submit(form);
    expect(sendChatMessage).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.submit(form);
    await waitFor(() => expect(sendChatMessage).toHaveBeenCalledTimes(1));
    fireEvent.submit(form);
    expect(sendChatMessage).toHaveBeenCalledTimes(1);

    resolveReply('Hello back.');
    expect(await screen.findByText('Hello back.')).toBeInTheDocument();
  });

  it('does not load profile resumes for an unauthenticated visitor', async () => {
    useAuth.mockReturnValue({ token: null });
    sendChatMessage.mockResolvedValue('Hello.');
    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open CareerConnect chat' }));

    expect(screen.queryByLabelText('Resume from your profile')).not.toBeInTheDocument();
    expect(fetchResumes).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Hello.')).toBeInTheDocument();
    expect(sendChatMessage).toHaveBeenCalledWith(
      expect.any(Array),
      null,
      null,
      ''
    );
  });

  it('shows a saved-resume loading error and disables the selector', async () => {
    fetchResumes.mockRejectedValue(new Error('Could not load saved resumes.'));
    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open CareerConnect chat' }));

    const resumeSelect = await screen.findByLabelText('Resume from your profile');
    expect(await screen.findByText('Saved resumes unavailable')).toBeInTheDocument();
    expect(resumeSelect).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load saved resumes.');
  });

  it('distinguishes duplicate filenames when upload times are missing or invalid', async () => {
    fetchResumes.mockResolvedValue([
      { id: 'resume-no-date', originalName: 'resume.pdf' },
      { id: 'resume-invalid-date', originalName: 'resume.pdf', createdAt: 'not-a-date' },
    ]);
    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open CareerConnect chat' }));

    const resumeSelect = await screen.findByLabelText('Resume from your profile');
    expect(Array.from(resumeSelect.options).map((option) => option.textContent)).toEqual([
      'Do not use a saved resume',
      'resume.pdf (ID resume-no-date)',
      'resume.pdf (ID resume-invalid-date)',
    ]);
  });

  it('rejects an oversized document and clears the error when the selection is canceled', () => {
    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open CareerConnect chat' }));
    const fileInput = screen.getByLabelText('Choose a document to share');
    const oversizedFile = new File(['resume'], 'resume.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversizedFile, 'size', { value: 5 * 1024 * 1024 + 1 });

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Document is too large. Maximum size is 5MB.');
    expect(sendChatMessage).not.toHaveBeenCalled();

    fireEvent.change(fileInput, { target: { files: [] } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('removes an attached document', () => {
    render(<Chatbot />);
    fireEvent.click(screen.getByRole('button', { name: 'Open CareerConnect chat' }));
    const document = new File(['resume'], 'resume.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Choose a document to share'), {
      target: { files: [document] },
    });

    expect(screen.getByText('resume.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove attached document' }));
    expect(screen.queryByText('resume.pdf')).not.toBeInTheDocument();
  });
});
