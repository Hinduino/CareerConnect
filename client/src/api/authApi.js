const API_BASE = "http://localhost:3000/api";

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function registerUser(email, password) {
  const response = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Registration failed");
  }
  return data;
}

export async function loginUser(email, password) {
  const response = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || "Login failed");
  }
  return data; // { message, token, user: { id, email } }
}
