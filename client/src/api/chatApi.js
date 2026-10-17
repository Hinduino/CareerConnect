const API_BASE = "http://localhost:3000/api";

export async function sendChatMessage(messages, token, document) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let body;
  if (document) {
    body = new FormData();
    body.append("messages", JSON.stringify(messages));
    body.append("document", document);
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ messages });
  }

  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers,
    body,
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
