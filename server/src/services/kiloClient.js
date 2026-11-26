const KILO_COMPLETIONS_URL = "https://api.kilo.ai/api/gateway/chat/completions";
const RETRY_DELAY_MS = 200;

function isTimeoutError(error) {
  return error?.name === "TimeoutError" || error?.name === "AbortError";
}

function waitBeforeRetry() {
  return new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
}

async function requestKiloCompletion(body, timeoutMs) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      response = await fetch(KILO_COMPLETIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      if (attempt === 0 && !isTimeoutError(error)) {
        await waitBeforeRetry();
        continue;
      }
      throw error;
    }

    if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
      await waitBeforeRetry();
      continue;
    }
    return response;
  }

  throw new Error("Kilo AI request failed after retry.");
}

module.exports = { requestKiloCompletion };
