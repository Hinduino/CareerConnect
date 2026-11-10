const API_BASE = 'http://localhost:3000/api';

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchRecruiterPostings(token) {
  const res = await fetch(`${API_BASE}/jobs/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafely(res);
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to fetch postings');
  }
  return data;
}

export async function createJobPosting(token, jobData) {
  const res = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(jobData),
  });
  const data = await parseJsonSafely(res);
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to create posting');
  }
  return data;
}

export async function updateJobPosting(token, id, jobData) {
  const res = await fetch(`${API_BASE}/jobs/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(jobData),
  });
  const data = await parseJsonSafely(res);
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to update posting');
  }
  return data;
}

export async function toggleArchiveJobPosting(token, id) {
  const res = await fetch(`${API_BASE}/jobs/${id}/archive`, {
    method: 'PATCH',
    headers: authHeaders(token),
  });
  const data = await parseJsonSafely(res);
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to toggle archive status');
  }
  return data;
}

export async function fetchApplicantsForJob(token, jobId) {
  const res = await fetch(`${API_BASE}/applications/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafely(res);
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to fetch applicants');
  }
  return data;
}