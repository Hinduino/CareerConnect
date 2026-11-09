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

// Whether the logged-in user already has an application on file for a job.
export async function fetchApplicationStatus(token, jobId) {
  const response = await fetch(`${API_BASE}/applications/status/${jobId}`, {
    headers: authHeaders(token),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Failed to check application status");
  }
  return data;
}

export async function submitApplication(token, jobId, resumeId) {
  const response = await fetch(`${API_BASE}/applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ jobId, resumeId }),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Failed to submit application.");
  }
  return data;
}

export async function cancelApplication(token, applicationId) {
  const response = await fetch(`${API_BASE}/applications/${applicationId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Failed to cancel application.");
  }
  return data;
}

// Recruiter-only: fetch the resume bytes attached to an application as a
// short-lived blob URL (the request needs an Authorization header, which a
// plain <a href> can't send).
export async function fetchApplicationResumeBlobUrl(token, applicationId, { download = false } = {}) {
  const response = await fetch(
    `${API_BASE}/applications/${applicationId}/resume${download ? "?download=1" : ""}`,
    { headers: authHeaders(token) }
  );
  if (!response.ok) {
    const data = await parseJsonSafely(response);
    throw new Error(data?.error || "Failed to fetch resume file");
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
// Retrieve all applications for the logged-in job seeker.
export async function fetchMyApplications(token) {
  const response = await fetch(`${API_BASE}/applications/my`, {
    headers: authHeaders(token),
  });

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(data?.error || "Failed to fetch applications");
  }

  return data;
}
// Update an application status (recruiter only).
export async function updateApplicationStatus(token, applicationId, status) {
  const response = await fetch(
    `${API_BASE}/applications/${applicationId}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(token),
      },
      body: JSON.stringify({ status }),
    }
  );

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(data?.error || "Failed to update application status");
  }

  return data;
}