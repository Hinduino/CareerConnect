import { fetchProfile, loginUser, registerUser, updateProfile } from './authApi';

const response = (body, options = {}) => ({
  ok: options.ok ?? true,
  json: options.invalidJson
    ? jest.fn().mockRejectedValue(new Error('invalid json'))
    : jest.fn().mockResolvedValue(body),
});

describe('authApi', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers a user', async () => {
    global.fetch.mockResolvedValue(response({ message: 'User registered successfully!' }));

    await expect(
      registerUser('new@example.com', 'Secure123!', 'Secure123!', 'recruiter')
    ).resolves.toEqual({ message: 'User registered successfully!' });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/register');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options.body)).toEqual({
      email: 'new@example.com',
      password: 'Secure123!',
      confirmPassword: 'Secure123!',
      role: 'recruiter',
    });
  });

  it('surfaces the server message when registration fails', async () => {
    global.fetch.mockResolvedValue(response({ error: 'Email already registered' }, { ok: false }));

    await expect(registerUser('new@example.com', 'Secure123!', 'Secure123!')).rejects.toThrow(
      'Email already registered'
    );
  });

  it('falls back to a default message when the error body is unreadable', async () => {
    global.fetch.mockResolvedValue(response(null, { ok: false, invalidJson: true }));

    await expect(registerUser('new@example.com', 'Secure123!', 'Secure123!')).rejects.toThrow(
      'Failed to register'
    );
  });

  it('logs a user in', async () => {
    global.fetch.mockResolvedValue(response({ token: 'jwt', user: { email: 'a@b.com' } }));

    await expect(loginUser('a@b.com', 'Secure123!')).resolves.toEqual({
      token: 'jwt',
      user: { email: 'a@b.com' },
    });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/login');
    expect(JSON.parse(options.body)).toEqual({ email: 'a@b.com', password: 'Secure123!' });
  });

  it('surfaces the server message when login fails', async () => {
    global.fetch.mockResolvedValue(response({ error: 'Invalid email or password' }, { ok: false }));

    await expect(loginUser('a@b.com', 'wrong')).rejects.toThrow('Invalid email or password');
  });

  it('updates the profile with the auth token', async () => {
    global.fetch.mockResolvedValue(response({ user: { name: 'Jane' } }));

    await expect(updateProfile('token', { name: 'Jane' })).resolves.toEqual({
      user: { name: 'Jane' },
    });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/profile');
    expect(options.method).toBe('PUT');
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token',
    });
  });

  it('fetches the logged-in profile', async () => {
    global.fetch.mockResolvedValue(response({ user: { name: 'Jane' } }));

    await expect(fetchProfile('token')).resolves.toEqual({ user: { name: 'Jane' } });
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/profile', {
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('surfaces the server message when the profile cannot load', async () => {
    global.fetch.mockResolvedValue(response({ error: 'Your session has expired. Please log in again.' }, { ok: false }));

    await expect(fetchProfile('token')).rejects.toThrow(
      'Your session has expired. Please log in again.'
    );
  });
});
