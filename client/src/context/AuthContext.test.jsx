const { act, fireEvent, render, screen, waitFor } = require('@testing-library/react');

jest.mock('../api/authApi', () => ({
  fetchProfile: jest.fn(),
  loginUser: jest.fn(),
  registerUser: jest.fn(),
  updateProfile: jest.fn(),
}));

const { AuthProvider, useAuth } = require('./AuthContext');
const { fetchProfile, loginUser, registerUser, updateProfile } = require('../api/authApi');

const STORAGE_KEY = 'careerconnect_auth';
const storedUser = { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com', role: 'job_seeker' };

// Small consumer exposing the context so the provider can be driven from tests.
function AuthConsumer() {
  const { user, token, isAuthenticated, login, register, saveProfile, logout } = useAuth();
  return (
    <div>
      <p>authenticated: {String(isAuthenticated)}</p>
      <p>token: {token || 'none'}</p>
      <p>user: {user?.name || 'none'}</p>
      <button type="button" onClick={() => login('jane@example.com', 'Secure123!')}>login</button>
      <button type="button" onClick={() => register('jane@example.com', 'Secure123!', 'Secure123!', 'job_seeker')}>register</button>
      <button type="button" onClick={() => saveProfile({ name: 'Jane Smith' })}>save</button>
      <button type="button" onClick={logout}>logout</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    fetchProfile.mockResolvedValue({ user: storedUser });
  });

  it('starts logged out when nothing is stored', () => {
    renderWithProvider();

    expect(screen.getByText('authenticated: false')).toBeInTheDocument();
    expect(screen.getByText('token: none')).toBeInTheDocument();
  });

  it('restores a stored session and refreshes the profile from the server', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: 'stored-token', user: storedUser }));
    fetchProfile.mockResolvedValue({ user: { ...storedUser, name: 'Jane Updated' } });

    renderWithProvider();

    expect(screen.getByText('authenticated: true')).toBeInTheDocument();
    expect(screen.getByText('token: stored-token')).toBeInTheDocument();
    await waitFor(() => expect(fetchProfile).toHaveBeenCalledWith('stored-token'));
    expect(await screen.findByText('user: Jane Updated')).toBeInTheDocument();
  });

  it('ignores corrupted stored sessions instead of crashing', () => {
    localStorage.setItem(STORAGE_KEY, 'not json {');

    renderWithProvider();

    expect(screen.getByText('authenticated: false')).toBeInTheDocument();
  });

  it('keeps the session when the background profile refresh fails', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: 'stored-token', user: storedUser }));
    fetchProfile.mockRejectedValue(new Error('Your session has expired. Please log in again.'));

    renderWithProvider();

    await waitFor(() => expect(fetchProfile).toHaveBeenCalled());
    expect(screen.getByText('authenticated: true')).toBeInTheDocument();
    expect(screen.getByText('user: Jane Doe')).toBeInTheDocument();
  });

  it('stores the token and user after logging in', async () => {
    loginUser.mockResolvedValue({ token: 'fresh-token', user: storedUser });

    renderWithProvider();
    await act(async () => {
      fireEvent.click(screen.getByText('login'));
    });

    expect(loginUser).toHaveBeenCalledWith('jane@example.com', 'Secure123!');
    expect(screen.getByText('authenticated: true')).toBeInTheDocument();
    expect(screen.getByText('token: fresh-token')).toBeInTheDocument();
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toMatchObject({ token: 'fresh-token' })
    );
  });

  it('registers without starting a session', async () => {
    registerUser.mockResolvedValue({ message: 'User registered successfully!' });

    renderWithProvider();
    await act(async () => {
      fireEvent.click(screen.getByText('register'));
    });

    expect(registerUser).toHaveBeenCalledWith('jane@example.com', 'Secure123!', 'Secure123!', 'job_seeker');
    expect(screen.getByText('authenticated: false')).toBeInTheDocument();
  });

  it('updates the cached user when the profile is saved', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: 'stored-token', user: storedUser }));
    updateProfile.mockResolvedValue({ user: { ...storedUser, name: 'Jane Smith' } });

    renderWithProvider();
    await act(async () => {
      fireEvent.click(screen.getByText('save'));
    });

    expect(updateProfile).toHaveBeenCalledWith('stored-token', { name: 'Jane Smith' });
    expect(screen.getByText('user: Jane Smith')).toBeInTheDocument();
  });

  it('clears the session and storage on logout', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: 'stored-token', user: storedUser }));

    renderWithProvider();
    await act(async () => {
      fireEvent.click(screen.getByText('logout'));
    });

    expect(screen.getByText('authenticated: false')).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBeNull());
  });

  it('throws when useAuth is used outside the provider', () => {
    // Silence React's error boundary logging for the expected throw.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<AuthConsumer />)).toThrow('useAuth must be used within an AuthProvider');
    consoleError.mockRestore();
  });
});
