export async function fetchAiResponse(url, options, serviceName) {
  try {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(95000),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new Error(`${serviceName} timed out. Please try again.`);
    }
    if (error instanceof TypeError) {
      throw new Error(`Could not connect to ${serviceName}. Check your connection and try again.`);
    }
    throw error;
  }
}
