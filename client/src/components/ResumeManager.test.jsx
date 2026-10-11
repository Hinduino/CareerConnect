const { fireEvent, render, screen, waitFor } = require('@testing-library/react');

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/resumeApi', () => ({
  deleteResume: jest.fn(),
  fetchResumeBlobUrl: jest.fn(),
  fetchResumeMetadata: jest.fn(),
  replaceResume: jest.fn(),
  uploadResume: jest.fn(),
}));

const ResumeManager = require('./ResumeManager').default;
const { useAuth } = require('../context/AuthContext');
const {
  deleteResume,
  fetchResumeBlobUrl,
  fetchResumeMetadata,
  replaceResume,
  uploadResume,
} = require('../api/resumeApi');

describe('ResumeManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ token: 'token', isAuthenticated: true });
    fetchResumeMetadata.mockResolvedValue(null);
    fetchResumeBlobUrl.mockResolvedValue('blob:resume');
    uploadResume.mockResolvedValue({
      originalName: 'resume.pdf',
      contentType: 'application/pdf',
      size: 2048,
    });
    replaceResume.mockResolvedValue({
      originalName: 'updated.pdf',
      contentType: 'application/pdf',
      size: 1024,
    });
    deleteResume.mockResolvedValue(undefined);
    URL.revokeObjectURL = jest.fn();
    window.confirm = jest.fn(() => true);
  });

  it('prompts signed-out users to log in', () => {
    useAuth.mockReturnValue({ token: null, isAuthenticated: false });
    render(<ResumeManager />);

    expect(screen.getByText('Log in to upload and manage your resume.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('loads resume metadata and previews PDF files inline', async () => {
    fetchResumeMetadata.mockResolvedValue({
      originalName: 'resume.pdf',
      contentType: 'application/pdf',
      size: 2048,
    });
    render(<ResumeManager />);

    expect(await screen.findByTitle('Preview of resume.pdf')).toHaveAttribute('src', 'blob:resume');
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    expect(fetchResumeBlobUrl).toHaveBeenCalledWith('token', { download: false });
  });

  it('shows an unavailable-preview explanation for non-PDF documents', async () => {
    fetchResumeMetadata.mockResolvedValue({
      originalName: 'resume.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 20,
    });
    render(<ResumeManager />);

    expect(await screen.findByText('Preview isn\'t available for this file type. Use View or Download above.')).toBeInTheDocument();
    expect(screen.queryByTitle('Preview of resume.docx')).not.toBeInTheDocument();
  });

  it('validates a selected file before upload and uploads a valid resume', async () => {
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
    await waitFor(() => expect(fetchResumeBlobUrl).toHaveBeenCalledWith('token', { download: false }));
  });

  it('replaces an existing resume, supports view and download, and deletes it', async () => {
    fetchResumeMetadata.mockResolvedValue({
      originalName: 'resume.pdf',
      contentType: 'application/pdf',
      size: 20,
    });
    const { container } = render(<ResumeManager />);
    await screen.findByRole('button', { name: 'Replace' });

    const file = new File(['updated'], 'updated.pdf', { type: 'application/pdf' });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
    expect(await screen.findByText('updated.pdf')).toBeInTheDocument();
    expect(replaceResume).toHaveBeenCalledWith('token', file);

    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    await waitFor(() => expect(fetchResumeBlobUrl).toHaveBeenCalledWith('token', { download: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(fetchResumeBlobUrl).toHaveBeenCalledWith('token', { download: true }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleteResume).toHaveBeenCalledWith('token'));
    expect(window.confirm).toHaveBeenCalledWith('Delete your uploaded resume?');
    expect(await screen.findByRole('button', { name: 'Upload Resume' })).toBeInTheDocument();
  });
});
