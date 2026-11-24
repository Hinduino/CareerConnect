import { fetchAiResponse } from "./aiRequest";

const API_BASE = "http://localhost:3000/api";

export async function sendChatMessage(messages, token, document, profileResumeId) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let body;
  if (document || profileResumeId) {
    body = new FormData();
    body.append("messages", JSON.stringify(messages));
    if (document) body.append("document", document);
    if (profileResumeId) body.append("profileResumeId", profileResumeId);
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ messages });
  }

  const response = await fetchAiResponse(`${API_BASE}/chat`, {
    method: "POST",
    headers,
    body,
  }, "the chat assistant");

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
