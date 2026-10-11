const API_BASE = "http://localhost:3000/api";

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchProfilePictureMetadata(token) {
  const response = await fetch(`${API_BASE}/profile/picture`, {
    headers: authHeaders(token),
  });
  if (response.status === 404) return null;
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Failed to fetch profile picture");
  }
  return data;
}

// <img> tags can't send an Authorization header, so (like the resume file)
// we fetch the image ourselves and hand back a short-lived blob URL.
export async function fetchProfilePictureBlobUrl(token) {
  const response = await fetch(`${API_BASE}/profile/picture/file`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    const data = await parseJsonSafely(response);
    throw new Error(data?.error || "Failed to fetch profile picture file");
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function uploadProfilePicture(token, file) {
  const formData = new FormData();
  formData.append("picture", file);

  const response = await fetch(`${API_BASE}/profile/picture`, {
    method: "PUT",
    headers: authHeaders(token),
    body: formData,
  });

  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Failed to upload profile picture");
  }
  return data;
}

export async function deleteProfilePicture(token) {
  const response = await fetch(`${API_BASE}/profile/picture`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!response.ok && response.status !== 204) {
    const data = await parseJsonSafely(response);
    throw new Error(data?.error || "Failed to delete profile picture");
  }
}
