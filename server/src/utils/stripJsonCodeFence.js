function stripJsonCodeFence(content) {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```") || !trimmed.endsWith("```")) {
    return trimmed;
  }

  let body = trimmed.slice(3, -3);
  if (body.slice(0, 4).toLowerCase() === "json") {
    body = body.slice(4);
  }
  return body.trim();
}

module.exports = stripJsonCodeFence;
