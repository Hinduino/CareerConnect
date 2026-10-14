const API_BASE = "http://localhost:3000/api";

export async function sendChatMessage(messages, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages }),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || "The chat assistant could not respond");
  }
  if (typeof data?.reply !== "string" || !data.reply.trim()) {
    throw new Error("The chat assistant returned an invalid response");
  }
  return data.reply.trim();
}
