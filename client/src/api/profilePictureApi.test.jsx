import {
  deleteProfilePicture,
  fetchProfilePictureBlobUrl,
  fetchProfilePictureMetadata,
  uploadProfilePicture,
} from './profilePictureApi';

const jsonResponse = (body, options = {}) => ({
  status: options.status ?? 200,
  ok: options.ok ?? true,
  json: jest.fn().mockResolvedValue(body),
  blob: jest.fn().mockResolvedValue(new Blob(['image'])),
});

describe('profilePictureApi', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    URL.createObjectURL = jest.fn(() => 'blob:picture');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches metadata with authentication and returns null when none exists', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ error: 'missing' }, { status: 404, ok: false }));

    await expect(fetchProfilePictureMetadata('token')).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/profile/picture', {
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('returns metadata on success and reports server errors', async () => {
    const metadata = { originalName: 'avatar.png', contentType: 'image/png', size: 12 };
    global.fetch.mockResolvedValueOnce(jsonResponse(metadata));
    await expect(fetchProfilePictureMetadata('token')).resolves.toEqual(metadata);

    global.fetch.mockResolvedValueOnce(jsonResponse({ error: 'Not allowed' }, { ok: false }));
    await expect(fetchProfilePictureMetadata('token')).rejects.toThrow('Not allowed');
  });

  it('fetches the protected image and returns a blob URL', async () => {
    const response = jsonResponse({});
    global.fetch.mockResolvedValue(response);

    await expect(fetchProfilePictureBlobUrl('token')).resolves.toBe('blob:picture');
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/profile/picture/file', {
      headers: { Authorization: 'Bearer token' },
    });
    expect(URL.createObjectURL).toHaveBeenCalledWith(await response.blob());
  });

  it('uploads a picture as multipart form data without overriding content type', async () => {
    const metadata = { originalName: 'avatar.png' };
    global.fetch.mockResolvedValue(jsonResponse(metadata));
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });

    await expect(uploadProfilePicture('token', file)).resolves.toEqual(metadata);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/profile/picture');
    expect(options.method).toBe('PUT');
    expect(options.headers).toEqual({ Authorization: 'Bearer token' });
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('picture')).toBe(file);
  });

  it('reports upload and image-fetch errors and tolerates empty delete responses', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ error: 'Bad image' }, { ok: false }));
    await expect(uploadProfilePicture('token', new File(['x'], 'x.png'))).rejects.toThrow('Bad image');

    global.fetch.mockResolvedValueOnce(jsonResponse({ error: 'Missing' }, { ok: false }));
    await expect(fetchProfilePictureBlobUrl('token')).rejects.toThrow('Missing');

    global.fetch.mockResolvedValueOnce({ status: 204, ok: false, json: jest.fn() });
    await expect(deleteProfilePicture('token')).resolves.toBeUndefined();
    expect(global.fetch.mock.calls[2][1]).toEqual({
      method: 'DELETE',
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('reports delete failures', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ error: 'Could not delete' }, { ok: false }));

    await expect(deleteProfilePicture('token')).rejects.toThrow('Could not delete');
  });
});
