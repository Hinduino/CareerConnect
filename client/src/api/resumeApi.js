const API_BASE = "http://localhost:3000/api";

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchResumeMetadata(userId) {
  const response = await fetch(`${API_BASE}/resumes/${userId}`);
  if (response.status === 404) return null;
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Failed to fetch resume");
  }
  return data;
}

export function getResumeFileUrl(userId, { download = false } = {}) {
  return `${API_BASE}/resumes/${userId}/file${download ? "?download=1" : ""}`;
}

async function sendResumeFile(userId, file, method) {
  const formData = new FormData();
  formData.append("resume", file);

  const response = await fetch(`${API_BASE}/resumes/${userId}`, {
    method,
    body: formData,
  });

  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Failed to upload resume");
  }
  return data;
}

export function uploadResume(userId, file) {
  return sendResumeFile(userId, file, "POST");
}

export function replaceResume(userId, file) {
  return sendResumeFile(userId, file, "PUT");
}

export async function deleteResume(userId) {
  const response = await fetch(`${API_BASE}/resumes/${userId}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) {
    const data = await parseJsonSafely(response);
    throw new Error(data?.error || "Failed to delete resume");
  }
}
