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

export async function fetchResumeMetadata(token) {
  const response = await fetch(`${API_BASE}/resumes`, {
    headers: authHeaders(token),
  });
  if (response.status === 404) return null;
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Failed to fetch resume");
  }
  return data;
}

export function getResumeFileUrl({ download = false } = {}) {
  return `${API_BASE}/resumes/file${download ? "?download=1" : ""}`;
}

// The <a> download/view links can't send an Authorization header, so we
// fetch the file with the token and hand the browser a short-lived blob URL
// instead of pointing it straight at the API.
export async function fetchResumeBlobUrl(token, { download = false } = {}) {
  const response = await fetch(getResumeFileUrl({ download }), {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    const data = await parseJsonSafely(response);
    throw new Error(data?.error || "Failed to fetch resume file");
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

async function sendResumeFile(token, file, method) {
  const formData = new FormData();
  formData.append("resume", file);

  const response = await fetch(`${API_BASE}/resumes`, {
    method,
    headers: authHeaders(token),
    body: formData,
  });

  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Failed to upload resume");
  }
  return data;
}

export function uploadResume(token, file) {
  return sendResumeFile(token, file, "POST");
}

export function replaceResume(token, file) {
  return sendResumeFile(token, file, "PUT");
}

export async function deleteResume(token) {
  const response = await fetch(`${API_BASE}/resumes`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!response.ok && response.status !== 204) {
    const data = await parseJsonSafely(response);
    throw new Error(data?.error || "Failed to delete resume");
  }
}
