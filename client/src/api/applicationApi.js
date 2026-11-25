const API_BASE =
  globalThis.process?.env?.VITE_API_URL || 'http://localhost:3000/api';

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
import { fetchBlobUrl, requestJson } from "./http";

// Whether the logged-in user already has an application on file for a job.
export function fetchApplicationStatus(token, jobId) {
  return requestJson(`/applications/status/${jobId}`, {
    token,
    fallbackError: "Failed to check application status",
  });
}

export function submitApplication(token, jobId, resumeId) {
  return requestJson("/applications", {
    method: "POST",
    token,
    body: { jobId, resumeId },
    fallbackError: "Failed to submit application.",
  });
}

export function cancelApplication(token, applicationId) {
  return requestJson(`/applications/${applicationId}`, {
    method: "DELETE",
    token,
    fallbackError: "Failed to cancel application.",
  });
}

// Fetch the resume bytes attached to an application as a short-lived blob URL
// (the request needs an Authorization header, which a plain <a href> can't
// send). Available to the applicant and to the recruiter who posted the job.
export function fetchApplicationResumeBlobUrl(token, applicationId, { download = false } = {}) {
  return fetchBlobUrl(
    `/applications/${applicationId}/resume${download ? "?download=1" : ""}`,
    token,
    "Failed to fetch resume file"
  );
}

// Recruiter-only: the applicant's professional profile plus the resume
// attached to one of the recruiter's own applications.
export function fetchApplicationApplicant(token, applicationId) {
  return requestJson(`/applications/${applicationId}/applicant`, {
    token,
    fallbackError: "Failed to load applicant profile",
  });
}

// Retrieve all applications for the logged-in job seeker.
export function fetchMyApplications(token) {
  return requestJson("/applications/my", {
    token,
    fallbackError: "Failed to fetch applications",
  });
}

// Update an application status (recruiter only).
export async function updateApplicationStatus(token, applicationId, status, interviewDate = null) {
  const res = await fetch(`${API_BASE}/applications/${applicationId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      status,
      ...(interviewDate ? { interviewDate } : {}),
    }),
  });
  const data = await parseJsonSafely(res);
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to update application status');
  }
  return data;
}

// Candidate declines an extended job offer (SCRUM-309)
export function declineJobOffer(token, applicationId) {
  return requestJson(`/applications/${applicationId}/decline-offer`, {
    method: "PATCH",
    token,
    body: {},
    fallbackError: "Failed to decline offer.",
  });
}
