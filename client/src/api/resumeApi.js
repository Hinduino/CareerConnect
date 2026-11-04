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

// All of the logged-in user's saved resumes (metadata only).
export async function fetchResumes(token) {
  const response = await fetch(`${API_BASE}/resumes`, {
    headers: authHeaders(token),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Failed to fetch resumes");
  }
  return data;
}

export function getResumeFileUrl(resumeId, { download = false } = {}) {
  return `${API_BASE}/resumes/${resumeId}/file${download ? "?download=1" : ""}`;
}

// The <a> download/view links can't send an Authorization header, so we
// fetch the file with the token and hand the browser a short-lived blob URL
// instead of pointing it straight at the API.
export async function fetchResumeBlobUrl(token, resumeId, { download = false } = {}) {
  const response = await fetch(getResumeFileUrl(resumeId, { download }), {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    const data = await parseJsonSafely(response);
    throw new Error(data?.error || "Failed to fetch resume file");
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function uploadResume(token, file) {
  const formData = new FormData();
  formData.append("resume", file);

  const response = await fetch(`${API_BASE}/resumes`, {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });

  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Failed to upload resume");
  }
  return data;
}

export async function replaceResume(token, resumeId, file) {
  const formData = new FormData();
  formData.append("resume", file);

  const response = await fetch(`${API_BASE}/resumes/${resumeId}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: formData,
  });

  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Failed to replace resume");
  }
  return data;
}

export async function deleteResume(token, resumeId) {
  const response = await fetch(`${API_BASE}/resumes/${resumeId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!response.ok && response.status !== 204) {
    const data = await parseJsonSafely(response);
    throw new Error(data?.error || "Failed to delete resume");
  }
}
