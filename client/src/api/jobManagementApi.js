const API_BASE =
  globalThis.process?.env?.VITE_API_URL || 'http://localhost:3000/api';

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function authHeaders(token, hasJsonBody = false) {
  return {
    ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  };
}

async function requestJson(path, { token, method = 'GET', body, fallbackError }) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: authHeaders(token, body !== undefined),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await parseJsonSafely(res);
  if (!res.ok) {
    throw new Error(data?.error || fallbackError);
  }
  return data;
}

export function fetchRecruiterPostings(token) {
  return requestJson('/jobs/mine', {
    token,
    fallbackError: 'Failed to fetch postings',
  });
}

export function createJobPosting(token, jobData) {
  return requestJson('/jobs', {
    token,
    method: 'POST',
    body: jobData,
    fallbackError: 'Failed to create posting',
  });
}

export function updateJobPosting(token, id, jobData) {
  return requestJson(`/jobs/${id}`, {
    token,
    method: 'PUT',
    body: jobData,
    fallbackError: 'Failed to update posting',
  });
}

export function toggleArchiveJobPosting(token, id) {
  return requestJson(`/jobs/${id}/archive`, {
    token,
    method: 'PATCH',
    fallbackError: 'Failed to toggle archive status',
  });
}

export function fetchApplicantsForJob(token, jobId) {
  return requestJson(`/applications/jobs/${jobId}`, {
    token,
    fallbackError: 'Failed to fetch applicants',
  });
}