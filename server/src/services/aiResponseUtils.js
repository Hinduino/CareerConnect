function summarizeAiReply(choice) {
  const message = choice?.message;
  const messageFields = Object.keys(message || {}).join(",") || "none";
  return `finish_reason=${choice?.finish_reason || "unknown"}, message_fields=${messageFields}`;
}

function logInvalidAiResponse(serviceName, summary, error, attempt) {
  if (attempt === 0) {
    console.error(
      "AI response could not be parsed. Retrying with stricter format instructions."
    );
    return true;
  }

  console.error("AI response could not be validated.");
  return false;
}

module.exports = { logInvalidAiResponse, summarizeAiReply };
