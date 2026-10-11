const { fireEvent, render, screen, waitFor } = require('@testing-library/react');

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/profilePictureApi', () => ({
  deleteProfilePicture: jest.fn(),
  fetchProfilePictureBlobUrl: jest.fn(),
  fetchProfilePictureMetadata: jest.fn(),
  uploadProfilePicture: jest.fn(),
}));

const ProfilePicture = require('./ProfilePicture').default;
const { useAuth } = require('../context/AuthContext');
const {
  deleteProfilePicture,
  fetchProfilePictureBlobUrl,
  fetchProfilePictureMetadata,
  uploadProfilePicture,
} = require('../api/profilePictureApi');

describe('ProfilePicture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ token: 'token', isAuthenticated: true });
    fetchProfilePictureMetadata.mockResolvedValue(null);
    fetchProfilePictureBlobUrl.mockResolvedValue('blob:picture');
    uploadProfilePicture.mockResolvedValue({});
    deleteProfilePicture.mockResolvedValue(undefined);
    URL.revokeObjectURL = jest.fn();
    window.confirm = jest.fn(() => true);
  });

  it('shows initials and upload controls when no picture exists', async () => {
    render(<ProfilePicture name="Jane Doe" />);

    expect(await screen.findByText('JD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload Photo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('loads the authenticated user picture into an image', async () => {
    fetchProfilePictureMetadata.mockResolvedValue({ originalName: 'avatar.png' });

    render(<ProfilePicture name="Jane Doe" />);

    expect(await screen.findByRole('img', { name: "Jane Doe's profile" })).toHaveAttribute('src', 'blob:picture');
    expect(fetchProfilePictureBlobUrl).toHaveBeenCalledWith('token');
    expect(screen.getByRole('button', { name: 'Change Photo' })).toBeInTheDocument();
  });

  it('validates extensions and maximum file size before uploading', async () => {
    const { container } = render(<ProfilePicture name="Jane Doe" />);
    const input = container.querySelector('input[type="file"]');

    fireEvent.change(input, { target: { files: [new File(['x'], 'avatar.svg')] } });
    expect(await screen.findByText('Only JPG, PNG, GIF, and WEBP images are allowed.')).toBeInTheDocument();
    expect(uploadProfilePicture).not.toHaveBeenCalled();

    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png')] },
    });
    expect(await screen.findByText('File is too large. Maximum size is 5MB.')).toBeInTheDocument();
    expect(uploadProfilePicture).not.toHaveBeenCalled();
  });

  it('uploads a valid image and refreshes its displayed blob URL', async () => {
    const { container } = render(<ProfilePicture name="Jane Doe" />);
    await screen.findByText('JD');
    const file = new File(['image'], 'avatar.webp', { type: 'image/webp' });

    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });

    expect(await screen.findByRole('img', { name: "Jane Doe's profile" })).toHaveAttribute('src', 'blob:picture');
    expect(uploadProfilePicture).toHaveBeenCalledWith('token', file);
    expect(fetchProfilePictureBlobUrl).toHaveBeenCalledWith('token');
  });

  it('removes a picture after confirmation and revokes its object URL', async () => {
    fetchProfilePictureMetadata.mockResolvedValue({ originalName: 'avatar.png' });
    render(<ProfilePicture name="Jane Doe" />);
    await screen.findByRole('img', { name: "Jane Doe's profile" });

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(deleteProfilePicture).toHaveBeenCalledWith('token'));
    expect(window.confirm).toHaveBeenCalledWith('Remove your profile picture?');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:picture');
    expect(await screen.findByText('JD')).toBeInTheDocument();
  });

  it('does not expose upload controls when signed out', async () => {
    useAuth.mockReturnValue({ token: null, isAuthenticated: false });
    render(<ProfilePicture name="" />);

    expect(await screen.findByText('?')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(fetchProfilePictureMetadata).not.toHaveBeenCalled();
  });
});
