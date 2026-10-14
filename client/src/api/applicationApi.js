const API_BASE = "http://localhost:3000/api";

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// Builds an Error that also carries the HTTP status, so callers can tell
// "already applied" (409) apart from other failures.
function requestError(response, data, fallback) {
  const error = new Error(data?.error || fallback);
  error.status = response.status;
  return error;
}

// Job seeker: apply to a job posting. Resolves to the saved application,
// including its status ("Applied") and a summary of the job.
export async function applyToJob(token, jobId) {
  const response = await fetch(`${API_BASE}/applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jobId }),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw requestError(response, data, "Failed to submit your application");
  }
  return data;
}

// Job seeker: all of their own applications, newest first, with status,
// status history, and job details.
export async function fetchMyApplications(token) {
  const response = await fetch(`${API_BASE}/applications/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw requestError(response, data, "Failed to load your applications");
  }
  return data;
}