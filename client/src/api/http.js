// Shared helpers for talking to the CareerConnect API. Every api/* module
// builds on these so base URL, auth headers, and error handling stay
// consistent in one place.

export const API_BASE = "http://localhost:3000/api";

export async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

// JSON request wrapper: sends an optional bearer token and JSON body, parses
// the JSON reply, and turns a non-ok response into an Error carrying the
// server's message (or `fallbackError` when the body has none).
export async function requestJson(path, { method, token, body, fallbackError } = {}) {
  const options = {};
  if (method) {
    options.method = method;
  }

  const headers = {
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(token ? authHeaders(token) : {}),
  };
  if (Object.keys(headers).length > 0) {
    options.headers = headers;
  }
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || fallbackError || "Request failed");
  }
  return data;
}

// Fetches a protected binary resource (resume file, profile picture) and
// hands back a short-lived blob URL, since plain <a>/<img> tags can't send
// an Authorization header.
export async function fetchBlobUrl(path, token, fallbackError) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    const data = await parseJsonSafely(response);
    throw new Error(data?.error || fallbackError || "Failed to fetch file");
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
