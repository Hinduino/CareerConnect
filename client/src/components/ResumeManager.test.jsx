const { fireEvent, render, screen, waitFor } = require('@testing-library/react');

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/resumeApi', () => ({
  deleteResume: jest.fn(),
  fetchResumeBlobUrl: jest.fn(),
  fetchResumes: jest.fn(),
  replaceResume: jest.fn(),
  uploadResume: jest.fn(),
}));

const ResumeManager = require('./ResumeManager').default;
const { useAuth } = require('../context/AuthContext');
const {
  deleteResume,
  fetchResumeBlobUrl,
  fetchResumes,
  replaceResume,
  uploadResume,
} = require('../api/resumeApi');

describe('ResumeManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ token: 'token', isAuthenticated: true });
    fetchResumes.mockResolvedValue([]);
    fetchResumeBlobUrl.mockResolvedValue('blob:resume');
    uploadResume.mockResolvedValue({
      id: 'resume-1',
      originalName: 'resume.pdf',
      contentType: 'application/pdf',
      size: 2048,
    });
    replaceResume.mockResolvedValue({
      id: 'resume-1',
      originalName: 'updated.pdf',
      contentType: 'application/pdf',
      size: 1024,
    });
    deleteResume.mockResolvedValue(undefined);
    URL.createObjectURL = jest.fn();
    URL.revokeObjectURL = jest.fn();
    window.confirm = jest.fn(() => true);
  });

  it('prompts signed-out users to log in', () => {
    useAuth.mockReturnValue({ token: null, isAuthenticated: false });
    render(<ResumeManager />);

    expect(screen.getByText('Log in to upload and manage your resumes.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no saved resumes', async () => {
    render(<ResumeManager />);
    expect(await screen.findByText("You haven't saved a resume yet.")).toBeInTheDocument();
  });

  it('shows only the most recently uploaded resume by default, with the rest behind a toggle', async () => {
    fetchResumes.mockResolvedValue([
      { id: 'resume-1', originalName: 'resume.pdf', contentType: 'application/pdf', size: 2048 },
      { id: 'resume-2', originalName: 'cover.docx', contentType: 'application/msword', size: 20 },
    ]);
    render(<ResumeManager />);

    expect(await screen.findByText('resume.pdf')).toBeInTheDocument();
    expect(screen.queryByText('cover.docx')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show other resumes (1)' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show other resumes (1)' }));
    expect(await screen.findByText('cover.docx')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide other resumes' }));
    expect(screen.queryByText('cover.docx')).not.toBeInTheDocument();
  });

  it('previews the most recent PDF resume inline', async () => {
    fetchResumes.mockResolvedValue([
      { id: 'resume-1', originalName: 'resume.pdf', contentType: 'application/pdf', size: 2048 },
    ]);
    render(<ResumeManager />);

    expect(await screen.findByTitle('Preview of resume.pdf')).toHaveAttribute('src', 'blob:resume');
    expect(fetchResumeBlobUrl).toHaveBeenCalledWith('token', 'resume-1', { download: false });
  });

  it('shows an unavailable-preview explanation for a non-PDF most recent resume', async () => {
    fetchResumes.mockResolvedValue([
      {
        id: 'resume-1',
        originalName: 'resume.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 20,
      },
    ]);
    render(<ResumeManager />);

    expect(
      await screen.findByText('Preview isn\'t available for this file type. Use View or Download above.')
    ).toBeInTheDocument();
    expect(screen.queryByTitle('Preview of resume.docx')).not.toBeInTheDocument();
  });

  it('validates a selected file before upload and adds a new resume to the list', async () => {
    const { container } = render(<ResumeManager />);
    await screen.findByRole('button', { name: 'Upload Resume' });
    const input = container.querySelector('input[type="file"]');

    fireEvent.change(input, { target: { files: [new File(['x'], 'resume.txt')] } });
    expect(await screen.findByText('Only PDF, DOC, and DOCX files are allowed.')).toBeInTheDocument();
    expect(uploadResume).not.toHaveBeenCalled();

    const file = new File(['resume'], 'resume.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('resume.pdf')).toBeInTheDocument();
    expect(uploadResume).toHaveBeenCalledWith('token', file);
  });

  it('views, downloads, replaces, and deletes an existing resume', async () => {
    fetchResumes.mockResolvedValue([
      { id: 'resume-1', originalName: 'resume.pdf', contentType: 'application/pdf', size: 20 },
    ]);
    const { container } = render(<ResumeManager />);
    await screen.findByText('resume.pdf');

    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    await waitFor(() => expect(fetchResumeBlobUrl).toHaveBeenCalledWith('token', 'resume-1', { download: false }));

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(fetchResumeBlobUrl).toHaveBeenCalledWith('token', 'resume-1', { download: true }));

    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    const file = new File(['updated'], 'updated.pdf', { type: 'application/pdf' });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
    await waitFor(() => expect(replaceResume).toHaveBeenCalledWith('token', 'resume-1', file));
    expect(await screen.findByText('updated.pdf')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleteResume).toHaveBeenCalledWith('token', 'resume-1'));
    expect(window.confirm).toHaveBeenCalledWith('Delete "updated.pdf"?');
    expect(screen.queryByText('updated.pdf')).not.toBeInTheDocument();
  });

  it('replaces a resume that is hidden behind the "other resumes" toggle', async () => {
    fetchResumes.mockResolvedValue([
      { id: 'resume-1', originalName: 'resume.pdf', contentType: 'application/pdf', size: 2048 },
      { id: 'resume-2', originalName: 'cover.docx', contentType: 'application/msword', size: 20 },
    ]);
    replaceResume.mockResolvedValue({
      id: 'resume-2',
      originalName: 'updated-cover.docx',
      contentType: 'application/msword',
      size: 30,
    });
    const { container } = render(<ResumeManager />);
    fireEvent.click(await screen.findByRole('button', { name: 'Show other resumes (1)' }));
    await screen.findByText('cover.docx');

    const replaceButtons = screen.getAllByRole('button', { name: 'Replace' });
    fireEvent.click(replaceButtons[1]);
    const file = new File(['updated'], 'updated-cover.docx', { type: 'application/msword' });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });

    await waitFor(() => expect(replaceResume).toHaveBeenCalledWith('token', 'resume-2', file));
    expect(await screen.findByText('updated-cover.docx')).toBeInTheDocument();
  });
});
