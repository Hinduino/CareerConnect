const API_BASE = "http://localhost:3000/api";

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// Public job listing (no auth required) — used by job seekers.
export async function fetchJobs(filters = {}) {
  const queryParams = new URLSearchParams(filters).toString();
  const response = await fetch(`${API_BASE}/jobs?${queryParams}`);
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Failed to load jobs");
  }
  return data;
}

export async function fetchJob(jobId) {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`);
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Failed to load job details");
  }
  return data;
}

// Recruiter-only: the postings this recruiter has created.
export async function fetchMyJobs(token) {
  const response = await fetch(`${API_BASE}/jobs/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Failed to load your job postings");
  }
  return data;
}

export async function createJob(token, job) {
  const response = await fetch(`${API_BASE}/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(job),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Failed to create job posting");
  }
  return data;
}

export async function updateJob(token, jobId, job) {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(job),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Failed to update job posting");
  }
  return data;
}

// Recruiter-only: delete a job posting owned by the logged-in recruiter.
export async function deleteJob(token, jobId) {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(data?.error || "Failed to delete job posting");
  }

  return data;
}