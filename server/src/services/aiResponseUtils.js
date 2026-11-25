function summarizeAiReply(choice) {
  const message = choice?.message;
  const messageFields = Object.keys(message || {}).join(",") || "none";
  return `finish_reason=${choice?.finish_reason || "unknown"}, message_fields=${messageFields}`;
}

function logInvalidAiResponse(serviceName, summary, error, attempt) {
  if (attempt === 0) {
    console.error(
      `${serviceName} response could not be parsed (${summary}); retrying with stricter format instructions.`
    );
    return true;
  }

  console.error(
    `${serviceName} response could not be validated (${summary}):`,
    error.message
  );
  return false;
}

module.exports = { logInvalidAiResponse, summarizeAiReply };
